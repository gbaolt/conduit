import { SEARCH_LIMIT_MAX } from '@conduit/contract';

import { orpc } from '@/lib/orpc';

export const SEARCH_LIMIT = SEARCH_LIMIT_MAX;

export const searchQuery = (text: string) =>
  orpc.search.query.queryOptions({
    input: { text, limit: SEARCH_LIMIT },
    enabled: text.trim().length > 0,
  });
