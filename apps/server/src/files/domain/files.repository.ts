import type { FileKind, ListFilesOutput, MessageFile } from '@conduit/contract';

/** A file row as the app sees it. */
export type StoredFile = MessageFile & {
  organizationId: string;
  uploaderId: string;
  roomId: string;
  messageId: string | null;
  key: string;
  status: 'pending' | 'ready';
  createdAt: Date;
  deletedAt: Date | null;
};

export type NewFile = Pick<
  StoredFile,
  | 'id'
  | 'organizationId'
  | 'uploaderId'
  | 'roomId'
  | 'name'
  | 'contentType'
  | 'size'
  | 'key'
>;

/** What `list` narrows to. `roomIds` are the rooms the viewer can read, so no other room's file is listed. */
export type FileListQuery = {
  organizationId: string;
  roomIds: string[];
  uploaderId?: string;
  kind?: FileKind;
  name?: string;
  before?: string;
  limit: number;
};

/** Uploaded files. Callers check room access first; this port knows only rows. */
export abstract class FilesRepository {
  /**
   * Inserts a pending file unless the workspace's files that are not deleted, pending ones included, plus this one
   * would pass `cap` bytes. Two uploads at once in one workspace take turns, so neither slips past the cap.
   * Returns the bytes already used when it refuses.
   */
  abstract createPending(
    file: NewFile,
    cap: number
  ): Promise<{ created: true } | { created: false; used: number }>;

  abstract find(fileId: string): Promise<StoredFile | null>;

  abstract findMany(fileIds: string[]): Promise<StoredFile[]>;

  /** Marks a pending file ready, with the size the browser measured. A ready file stays as it is. */
  abstract markReady(
    fileId: string,
    dimensions: { width: number | null; height: number | null }
  ): Promise<StoredFile>;

  /** Marks a file no message carries as deleted. Does nothing to an attached file. */
  abstract cancel(fileId: string): Promise<void>;

  /** Sent, unremoved files in `roomIds`, newest first. An unknown `before` lists nothing. */
  abstract list(query: FileListQuery): Promise<ListFilesOutput>;

  /**
   * Files to remove for good: uploads left pending since before `pendingBefore`, and deleted files whose
   * search documents are already gone.
   */
  abstract sweepable(
    pendingBefore: Date,
    limit: number
  ): Promise<{ id: string; key: string }[]>;

  abstract purge(fileIds: string[]): Promise<void>;
}
