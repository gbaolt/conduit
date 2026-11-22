import type { SearchDoc } from '@/search/domain/search-doc';
import type { SearchIndex } from '@/search/domain/search-index.port';

/**
 * An index in memory that returns every document in the namespace for any query, so a test proves that
 * Postgres, not the index, decides what a person may see. Set `state.fail` to make every call throw.
 */
export function createFakeSearchIndex() {
  const namespaces = new Map<string, Map<string, SearchDoc>>();
  const state = { fail: false };
  const docs = (namespace: string) => {
    if (!namespaces.has(namespace)) namespaces.set(namespace, new Map());
    return namespaces.get(namespace)!;
  };
  const guard = () => {
    if (state.fail) throw new Error('The search index is down.');
  };
  const index: SearchIndex = {
    upsert: async (namespace, upserted) => {
      guard();
      for (const doc of upserted) docs(namespace).set(doc.id, doc);
    },
    delete: async (namespace, ids) => {
      guard();
      for (const id of ids) docs(namespace).delete(id);
    },
    query: async (namespace, { topK, includeData }) => {
      guard();
      return [...docs(namespace).values()].slice(0, topK).map((doc) => ({
        id: doc.id,
        score: 1,
        metadata: doc.metadata,
        ...(includeData && { data: doc.data }),
      }));
    },
  };
  return { index, docs, state };
}
