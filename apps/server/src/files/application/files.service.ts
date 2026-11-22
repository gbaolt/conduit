import {
  canChannel,
  checkChannel,
  FILE_SIZE_MAX,
  FILE_TEXT_PREVIEW_MAX,
  fileKind,
  FILES_PAGE_DEFAULT,
  type FileText,
  fileTooLargeMessage,
  type FileUploadInput,
  type FileUrl,
  type ListFilesInput,
  type MessageFile,
  storageFullMessage,
  WORKSPACE_STORAGE_MAX,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { fileError } from '@/files/domain/file-errors';
import { fileKey } from '@/files/domain/file-key';
import { readableText } from '@/files/domain/file-text';
import {
  FilesRepository,
  type StoredFile,
} from '@/files/domain/files.repository';
import { RoomsRepository } from '@/rooms/domain/rooms.repository';
import { ObjectStorage } from '@/storage/domain/object-storage';

/** An upload not completed within a day is abandoned. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const SWEEP_LIMIT = 1000;

export type FileViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

export function toMessageFile(file: StoredFile): MessageFile {
  return {
    id: file.id,
    name: file.name,
    contentType: file.contentType,
    size: file.size,
    width: file.width,
    height: file.height,
  };
}

@Injectable()
export class FilesService {
  constructor(
    @Inject(FilesRepository) private readonly files: FilesRepository,
    @Inject(RoomsRepository) private readonly rooms: RoomsRepository,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage
  ) {}

  /** A file for a message the viewer can start or reply with in the room. */
  async uploadUrl(viewer: FileViewer, input: FileUploadInput) {
    const room = await this.rooms.find(viewer, input.roomId);
    if (!room || checkChannel('view', viewer.workspaceRole, room)) {
      throw fileError('NOT_FOUND', 'Channel not found.');
    }
    if (
      !canChannel('sendMessage', viewer.workspaceRole, room) &&
      !canChannel('reply', viewer.workspaceRole, room)
    ) {
      throw fileError(room.archivedAt ? 'CHANNEL_ARCHIVED' : 'FORBIDDEN');
    }
    if (input.size > FILE_SIZE_MAX) {
      throw fileError('FILE_TOO_LARGE', fileTooLargeMessage(input.size));
    }

    const id = crypto.randomUUID();
    const key = fileKey(viewer.organizationId, id, input.name);
    // Signing first means a deployment without storage refuses before a row counts toward the cap.
    const { uploadUrl } = await this.storage.presignUpload({
      key,
      contentType: input.contentType,
      size: input.size,
    });
    const result = await this.files.createPending(
      {
        id,
        organizationId: viewer.organizationId,
        uploaderId: viewer.userId,
        roomId: room.id,
        name: input.name,
        contentType: input.contentType,
        size: input.size,
        key,
      },
      WORKSPACE_STORAGE_MAX
    );
    if (!result.created) {
      throw fileError('STORAGE_FULL', storageFullMessage(result.used));
    }
    return { fileId: id, uploadUrl };
  }

  /** Only the uploader finishes an upload, and only once storage holds the promised bytes. */
  async complete(
    viewer: FileViewer,
    input: { fileId: string; width?: number; height?: number }
  ) {
    const file = await this.ownFile(viewer, input.fileId);
    if (file.status === 'ready') {
      return toMessageFile(file);
    }
    const stored = await this.storage.head(file.key);
    if (stored?.size !== file.size) {
      throw fileError('UPLOAD_MISSING');
    }
    const measurable = ['image', 'video'].includes(fileKind(file.contentType));
    return toMessageFile(
      await this.files.markReady(file.id, {
        width: (measurable && input.width) || null,
        height: (measurable && input.height) || null,
      })
    );
  }

  /** Drops the viewer's own upload before a message carries it. The sweep removes the object. */
  async cancel(viewer: FileViewer, fileId: string) {
    const file = await this.ownFile(viewer, fileId);
    if (file.messageId) {
      throw fileError('NOT_FOUND');
    }
    await this.files.cancel(file.id);
  }

  /** Links for attached files in rooms the viewer can read. Anything else is left out, so a refusal looks like a missing file. */
  /** Deletes the objects and rows of abandoned uploads and deleted files. Returns how many it removed. */
  async sweep(now: Date) {
    const files = await this.files.sweepable(
      new Date(now.getTime() - PENDING_TTL_MS),
      SWEEP_LIMIT
    );
    if (files.length === 0) return 0;
    await this.storage.delete(files.map((file) => file.key));
    await this.files.purge(files.map((file) => file.id));
    return files.length;
  }

  /** The Files page: sent files in rooms the viewer can read. A room they cannot read lists nothing. */
  async list(viewer: FileViewer, input: ListFilesInput) {
    const readable = await this.rooms.accessibleRoomIds(viewer);
    const roomIds = input.roomId
      ? readable.filter((id) => id === input.roomId)
      : readable;
    if (roomIds.length === 0) return { files: [], hasMore: false };
    return this.files.list({
      organizationId: viewer.organizationId,
      roomIds,
      uploaderId: input.uploaderId,
      kind: input.kind,
      name: input.name || undefined,
      before: input.before,
      limit: input.limit ?? FILES_PAGE_DEFAULT,
    });
  }

  /** The sent files of `fileIds` the viewer can read now. The rest are left out, as if they did not exist. */
  private async readableFiles(viewer: FileViewer, fileIds: string[]) {
    const [files, readable] = await Promise.all([
      this.files.findMany(fileIds),
      this.rooms.accessibleRoomIds(viewer),
    ]);
    const rooms = new Set(readable);
    return files.filter(
      (file) =>
        file.organizationId === viewer.organizationId &&
        file.status === 'ready' &&
        file.messageId !== null &&
        !file.deletedAt &&
        rooms.has(file.roomId)
    );
  }

  /**
   * The start of a text file the viewer can read, for its preview. Only the first `FILE_TEXT_PREVIEW_MAX` bytes
   * are read from storage, so a large log costs no more than a small one.
   */
  async text(viewer: FileViewer, fileId: string): Promise<FileText> {
    const [file] = await this.readableFiles(viewer, [fileId]);
    if (!file) throw fileError('NOT_FOUND');
    if (fileKind(file.contentType) !== 'text') throw fileError('NOT_TEXT');
    const truncated = file.size > FILE_TEXT_PREVIEW_MAX;
    const bytes = await this.storage.readRange(file.key, FILE_TEXT_PREVIEW_MAX);
    const text = readableText(bytes, truncated);
    if (text === null) throw fileError('NOT_TEXT');
    return { text, truncated };
  }

  async urls(viewer: FileViewer, fileIds: string[]): Promise<FileUrl[]> {
    const visible = await this.readableFiles(viewer, fileIds);
    return Promise.all(
      visible.map(async (file) => {
        const options = { filename: file.name, contentType: file.contentType };
        const [viewUrl, downloadUrl] = await Promise.all([
          // Text stays out of the browser's own viewer, so an uploaded page never runs from storage.
          ['other', 'text'].includes(fileKind(file.contentType))
            ? null
            : this.storage.presignDownload(file.key, {
                ...options,
                inline: true,
              }),
          this.storage.presignDownload(file.key, { ...options, inline: false }),
        ]);
        return { id: file.id, viewUrl, downloadUrl };
      })
    );
  }

  private async ownFile(viewer: FileViewer, fileId: string) {
    const file = await this.files.find(fileId);
    if (
      !file ||
      file.deletedAt ||
      file.organizationId !== viewer.organizationId ||
      file.uploaderId !== viewer.userId
    ) {
      throw fileError('NOT_FOUND');
    }
    return file;
  }
}
