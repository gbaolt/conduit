import type {
  FeedFilter,
  FeedStreamRow,
  ListFeedOutput,
} from '@conduit/contract';
import type { InfiniteData } from '@tanstack/react-query';
import { queryOptions, skipToken } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc';

export type FeedPages = InfiniteData<ListFeedOutput, string | undefined>;

/** Pages of Activity entries. Page 0 holds the newest, and each page is newest first. */
export const feedQuery = (filter: FeedFilter) =>
  orpc.feed.list.infiniteOptions({
    input: (before: string | undefined) => ({ filter, before }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore ? last.entries.at(-1)?.id : undefined,
  });

/** The `feed` stream's rows, one per unread item. Only the stream writes it, so there is no fetch. */
export const feedUnreadQuery = queryOptions<FeedStreamRow[]>({
  queryKey: ['live', 'feed'],
  queryFn: skipToken,
  staleTime: Infinity,
});

/** The pages with the entries in `ids` marked read, or every unread entry when `ids` is omitted. */
export function markEntriesRead(
  data: FeedPages | undefined,
  readAt: Date,
  ids?: readonly string[]
): FeedPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      entries: page.entries.map((entry) =>
        !entry.readAt && (!ids || ids.includes(entry.id))
          ? { ...entry, readAt }
          : entry
      ),
    })),
  };
}
