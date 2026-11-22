import {
  canAttachToRoom,
  canChannel,
  checkChannel,
  FILE_KINDS,
  FILE_SIZE_MAX,
  FILE_TEXT_PREVIEW_MAX,
  type FileCounts,
  type FileFilters,
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

  /** The room, when the viewer can start or reply with a message there. */
  private async postableRoom(viewer: FileViewer, roomId: string) {
    const room = await this.rooms.find(viewer, roomId);
    if (!room || checkChannel('view', viewer.workspaceRole, room)) {
      throw fileError('NOT_FOUND', 'Channel not found.');
    }
    if (
      !canChannel('sendMessage', viewer.workspaceRole, room) &&
      !canChannel('reply', viewer.workspaceRole, room)
    ) {
      throw fileError(room.archivedAt ? 'CHANNEL_ARCHIVED' : 'FORBIDDEN');
    }
    return room;
  }

  /** A file for a message the viewer can start or reply with in the room. */
  async uploadUrl(viewer: FileViewer, input: FileUploadInput) {
    const room = await this.postableRoom(viewer, input.roomId);
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

  /**
   * Copies a sent file into `roomId` for the viewer's next message there. The source room's visibility is read
   * now, so a channel made private since the picker opened is refused. A failed copy leaves a pending row, which
   * the sweep removes as it does an abandoned upload.
   */
  async attach(viewer: FileViewer, input: { fileId: string; roomId: string }) {
    const [source] = await this.readableFiles(viewer, [input.fileId]);
    const sourceRoom = source && (await this.rooms.find(viewer, source.roomId));
    if (!source || !sourceRoom) throw fileError('NOT_FOUND');
    if (!canAttachToRoom({ room: sourceRoom }, input.roomId)) {
      throw fileError('FILE_NOT_SHAREABLE');
    }
    const room = await this.postableRoom(viewer, input.roomId);

    const id = crypto.randomUUID();
    const key = fileKey(viewer.organizationId, id, source.name);
    const result = await this.files.createPending(
      {
        id,
        organizationId: viewer.organizationId,
        uploaderId: viewer.userId,
        roomId: room.id,
        name: source.name,
        contentType: source.contentType,
        size: source.size,
        key,
        sourceFileId: source.sourceFileId ?? source.id,
      },
      WORKSPACE_STORAGE_MAX
    );
    if (!result.created) {
      throw fileError('STORAGE_FULL', storageFullMessage(result.used));
    }
    await this.storage.copy(source.key, key);
    return toMessageFile(
      await this.files.markReady(id, {
        width: source.width,
        height: source.height,
      })
    );
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

  /** The query for `filters` over rooms the viewer can read, or null when nothing can match. */
  private async filterQuery(viewer: FileViewer, filters: FileFilters) {
    const readable = await this.rooms.accessibleRoomIds(viewer);
    const roomIds = filters.roomId
      ? readable.filter((id) => id === filters.roomId)
      : readable;
    const mine = filters.owner === 'me';
    if (roomIds.length === 0) return null;
    if (mine && filters.uploaderId && filters.uploaderId !== viewer.userId) {
      return null;
    }
    return {
      organizationId: viewer.organizationId,
      roomIds,
      uploaderId: mine ? viewer.userId : filters.uploaderId,
      notUploaderId: filters.owner === 'others' ? viewer.userId : undefined,
      name: filters.name || undefined,
      roomKind: filters.roomKind,
    };
  }

  /** The Files page: sent files in rooms the viewer can read. A room they cannot read lists nothing. */
  async list(viewer: FileViewer, input: ListFilesInput) {
    const query = await this.filterQuery(viewer, input);
    if (!query) return { files: [], hasMore: false };
    return this.files.list({
      ...query,
      kinds: input.kinds,
      before: input.before,
      limit: input.limit ?? FILES_PAGE_DEFAULT,
    });
  }

  /** How many files of each kind `list` would show for the same filters. */
  async counts(viewer: FileViewer, filters: FileFilters) {
    const query = await this.filterQuery(viewer, filters);
    if (query) return this.files.counts(query);
    return Object.fromEntries(
      FILE_KINDS.map((kind) => [kind, 0])
    ) as FileCounts;
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

  /** The sent files of `fileIds` the viewer can read now in a channel, public or private. DM files are left out. */
  async channelFiles(viewer: FileViewer, fileIds: string[]) {
    const files = await this.readableFiles(viewer, fileIds);
    const roomIds = [...new Set(files.map((file) => file.roomId))];
    const rooms = await Promise.all(
      roomIds.map((roomId) => this.rooms.find(viewer, roomId))
    );
    const channels = new Set(
      rooms.flatMap((room) => (room?.kind === 'channel' ? [room.id] : []))
    );
    return files.filter((file) => channels.has(file.roomId));
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

  /** Links for attached files in rooms the viewer can read. Anything else is left out, so a refusal looks like a missing file. */
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
