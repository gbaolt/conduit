import type { FileSource, MessageSource } from './search-doc';

export type SearchSyncKind = 'message' | 'file';

/** A claimed row. `dueAt` is the lease it was claimed with, so a change made meanwhile is never lost. */
export type SearchSyncRow = {
  kind: SearchSyncKind;
  targetId: string;
  organizationId: string;
  dueAt: Date;
  attempts: number;
};

/** A file as the drain sees it. `source` is null once it is deleted or no longer carried by a message. */
export type FileForSearch = {
  key: string;
  size: number;
  indexedChunks: number;
  source: FileSource | null;
};

/**
 * The rows that say what the search index must catch up on, and the state the drain reads to do it. Every time is
 * the database's clock, so a server whose clock runs ahead never sees a row as due early or late.
 */
export abstract class SearchSyncRepository {
  /** Leases up to `limit` due rows for `leaseMs`. Two drains at once never lease the same row. */
  abstract claim(input: {
    organizationId?: string;
    limit: number;
    leaseMs: number;
  }): Promise<SearchSyncRow[]>;

  /** Removes the row, unless a change wrote it again after it was claimed. */
  abstract finish(row: SearchSyncRow): Promise<void>;

  /** Records the failure and retries in `retryMs`, unless a change wrote the row again after it was claimed. */
  abstract fail(
    row: SearchSyncRow,
    error: string,
    retryMs: number
  ): Promise<void>;

  /** A message that is not deleted, or null. */
  abstract message(messageId: string): Promise<MessageSource | null>;

  /** Null when the row is gone. */
  abstract file(fileId: string): Promise<FileForSearch | null>;

  abstract setIndexedChunks(fileId: string, count: number): Promise<void>;
}
