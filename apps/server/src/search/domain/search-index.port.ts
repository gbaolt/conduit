import type { SearchDoc, SearchDocMetadata } from './search-doc';

export type SearchIndexQuery = {
  text: string;
  /** Upstash's filter syntax, as in `roomId IN ('a', 'b') AND hasFile = 1`. */
  filter?: string;
  topK: number;
  /** `keyword` is BM25 alone. `hybrid` fuses it with the embedding match. */
  mode: 'hybrid' | 'keyword';
  /** Returns each hit's `data`, the text the index holds. */
  includeData?: boolean;
};

export type SearchIndexHit = {
  id: string;
  score: number;
  metadata: SearchDocMetadata;
  /** Set when the query asked for `includeData`. */
  data?: string;
};

/**
 * The search index. Each workspace is its own namespace, so no query reaches another workspace's documents.
 * It never decides access: callers re-check every hit against Postgres.
 */
export abstract class SearchIndex {
  abstract upsert(namespace: string, docs: SearchDoc[]): Promise<void>;

  /** An id that is not stored is not an error. */
  abstract delete(namespace: string, ids: string[]): Promise<void>;

  abstract query(
    namespace: string,
    query: SearchIndexQuery
  ): Promise<SearchIndexHit[]>;
}
