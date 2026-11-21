import { Inject, Injectable, Logger } from '@nestjs/common';

import { FileText } from '@/search/domain/file-text.port';
import {
  fileDocId,
  fileDocIds,
  fileDocs,
  messageDoc,
  messageDocId,
} from '@/search/domain/search-doc';
import { SearchIndex } from '@/search/domain/search-index.port';
import {
  SearchSyncRepository,
  type SearchSyncRow,
} from '@/search/domain/search-sync.repository';

export const DRAIN_LIMIT = 100;
/** Long enough for a large PDF to be read and upserted before another drain may take its row. */
export const LEASE_MS = 5 * 60 * 1000;
const RETRY_MAX_MS = 6 * 60 * 60 * 1000;

/** 2, 4, 8 minutes and so on after each failure, never more than 6 hours. */
export const retryDelay = (attempts: number) =>
  Math.min(2 ** attempts * 60 * 1000, RETRY_MAX_MS);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Brings the search index in line with Postgres, one sync row at a time. Each row reads its target's current
 * state, so a row run twice, out of order, or after a crash leaves the index the same.
 */
@Injectable()
export class SearchSyncService {
  private readonly logger = new Logger(SearchSyncService.name);

  constructor(
    @Inject(SearchSyncRepository)
    private readonly rows: SearchSyncRepository,
    @Inject(SearchIndex) private readonly index: SearchIndex,
    @Inject(FileText) private readonly fileText: FileText
  ) {}

  /** Syncs up to `limit` due rows, in one workspace or in all of them. A failed row waits and retries. */
  async drain(organizationId?: string, limit = DRAIN_LIMIT) {
    const claimed = await this.rows.claim({
      organizationId,
      limit,
      leaseMs: LEASE_MS,
    });
    let synced = 0;
    for (const row of claimed) {
      try {
        await this.sync(row);
        await this.rows.finish(row);
        synced += 1;
      } catch (error) {
        await this.rows.fail(
          row,
          errorMessage(error),
          retryDelay(row.attempts + 1)
        );
      }
    }
    return { claimed: claimed.length, synced };
  }

  /** For `waitUntil` after a change: never rejects, so a search outage never fails a send. */
  async drainQuietly(organizationId: string) {
    try {
      await this.drain(organizationId);
    } catch (error) {
      this.logger.warn(`Search sync failed: ${errorMessage(error)}`);
    }
  }

  private async sync(row: SearchSyncRow) {
    const namespace = row.organizationId;
    if (row.kind === 'message') {
      const message = await this.rows.message(row.targetId);
      const doc = message && messageDoc(message);
      if (doc) await this.index.upsert(namespace, [doc]);
      else await this.index.delete(namespace, [messageDocId(row.targetId)]);
      return;
    }

    const file = await this.rows.file(row.targetId);
    if (!file) {
      await this.index.delete(namespace, [fileDocId(row.targetId, 0)]);
      return;
    }
    if (!file.source) {
      await this.index.delete(
        namespace,
        fileDocIds(row.targetId, 0, Math.max(1, file.indexedChunks))
      );
      await this.rows.setIndexedChunks(row.targetId, 0);
      return;
    }
    const text = await this.fileText.extract({
      key: file.key,
      contentType: file.source.contentType,
      size: file.size,
    });
    const docs = fileDocs(file.source, text);
    await this.index.upsert(namespace, docs);
    const stale = fileDocIds(row.targetId, docs.length, file.indexedChunks);
    if (stale.length > 0) await this.index.delete(namespace, stale);
    await this.rows.setIndexedChunks(row.targetId, docs.length);
  }
}
