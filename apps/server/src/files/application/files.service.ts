import {
  canChannel,
  checkChannel,
  FILE_SIZE_MAX,
  fileKind,
  FILES_PAGE_DEFAULT,
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
import {
  FilesRepository,
  type StoredFile,
} from '@/files/domain/files.repository';
import { RoomsRepository } from '@/rooms/domain/rooms.repository';
import { ObjectStorage } from '@/storage/domain/object-storage';

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

  async urls(viewer: FileViewer, fileIds: string[]): Promise<FileUrl[]> {
    const [files, readable] = await Promise.all([
      this.files.findMany(fileIds),
      this.rooms.accessibleRoomIds(viewer),
    ]);
    const rooms = new Set(readable);
    const visible = files.filter(
      (file) =>
        file.organizationId === viewer.organizationId &&
        file.status === 'ready' &&
        file.messageId !== null &&
        !file.deletedAt &&
        rooms.has(file.roomId)
    );
    return Promise.all(
      visible.map(async (file) => {
        const options = { filename: file.name, contentType: file.contentType };
        const [viewUrl, downloadUrl] = await Promise.all([
          fileKind(file.contentType) === 'other'
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
