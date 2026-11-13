import {
  FEED_SOURCES,
  type FeedFilter,
  type FeedSource,
  type FeedStreamRow,
  type ListFeedOutput,
} from '@conduit/contract';
import type { InfiniteData } from '@tanstack/react-query';
import { queryOptions, skipToken } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc';

export type FeedPages = InfiniteData<ListFeedOutput, string | undefined>;

export type FeedListInput = {
  filter: FeedFilter;
  sources: readonly FeedSource[];
  q: string;
};

/** One spelling per set of sources, in the contract's order. Every source is the same set as none. */
export function normalizeSources(sources: readonly FeedSource[]): FeedSource[] {
  const picked = FEED_SOURCES.filter((source) => sources.includes(source));
  return picked.length === FEED_SOURCES.length ? [] : picked;
}

/** Pages of Activity entries. Page 0 holds the newest, and each page is newest first. */
export const feedQuery = ({ filter, sources, q }: FeedListInput) => {
  const input = { filter, sources: normalizeSources(sources), q: q.trim() };
  return orpc.feed.list.infiniteOptions({
    input: (before: string | undefined) => ({ ...input, before }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore ? last.entries.at(-1)?.id : undefined,
  });
};

/** The `feed` stream's rows, one per unread item. Only the stream writes it, so there is no fetch. */
export const feedUnreadQuery = queryOptions<FeedStreamRow[]>({
  queryKey: ['live', 'feed'],
  queryFn: skipToken,
  staleTime: Infinity,
});

/**
 * The pages with the entries in `ids`, or every entry when `ids` is omitted, set to `readAt`. A null `readAt`
 * marks them unread. An entry already in that state keeps its time.
 */
export function setEntriesRead(
  data: FeedPages | undefined,
  readAt: Date | null,
  ids?: readonly string[]
): FeedPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      entries: page.entries.map((entry) =>
        !entry.readAt === !readAt || (ids && !ids.includes(entry.id))
          ? entry
          : { ...entry, readAt }
      ),
    })),
  };
}
