import { Injectable } from '@nestjs/common';
import { Index, QueryMode } from '@upstash/vector';

import type { SearchDoc, SearchDocMetadata } from '@/search/domain/search-doc';
import type {
  SearchIndex,
  SearchIndexQuery,
} from '@/search/domain/search-index.port';

/** Upstash takes at most 1,000 vectors in one upsert or delete. */
const BATCH = 1000;

/** Upstash Vector on a hybrid index: BM25 plus an embedding model Upstash runs, so the server sends only text. */
@Injectable()
export class UpstashSearchIndex implements SearchIndex {
  private client: Index<SearchDocMetadata> | undefined;

  private index() {
    if (this.client) return this.client;
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url || !token) throw new Error('The search index is not configured.');
    this.client = new Index<SearchDocMetadata>({ url, token });
    return this.client;
  }

  async upsert(namespace: string, docs: SearchDoc[]) {
    const space = this.index().namespace(namespace);
    for (let start = 0; start < docs.length; start += BATCH) {
      await space.upsert(docs.slice(start, start + BATCH));
    }
  }

  async delete(namespace: string, ids: string[]) {
    const space = this.index().namespace(namespace);
    for (let start = 0; start < ids.length; start += BATCH) {
      await space.delete(ids.slice(start, start + BATCH));
    }
  }

  async query(namespace: string, query: SearchIndexQuery) {
    const hits = await this.index()
      .namespace(namespace)
      .query({
        data: query.text,
        topK: query.topK,
        filter: query.filter,
        includeMetadata: true,
        includeData: query.includeData,
        queryMode:
          query.mode === 'keyword' ? QueryMode.SPARSE : QueryMode.HYBRID,
      });
    return hits.flatMap((hit) =>
      hit.metadata
        ? [
            {
              id: String(hit.id),
              score: hit.score,
              metadata: hit.metadata,
              ...(hit.data !== undefined && { data: hit.data }),
            },
          ]
        : []
    );
  }
}
