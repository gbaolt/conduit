'use client';

import {
  FEED_PAGE_MAX,
  type FeedEntry,
  FeedStreamRowSchema,
} from '@conduit/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { client, orpc } from '@/lib/orpc';
import { useLiveRows } from '@/services/messages/live';

import { type FeedPages, feedUnreadQuery, setEntriesRead } from './queries';

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/**
 * Opens the `feed` stream and keeps its rows in the cache. When the set of unread items changes after the
 * first result, the loaded pages of the feed refetch. Mount it once per workspace.
 */
export function useFeedStream() {
  const queryClient = useQueryClient();
  const known = useRef<ReadonlySet<string> | null>(null);

  return useLiveRows({ kind: 'feed' }, FeedStreamRowSchema, (rows) => {
    queryClient.setQueryData(feedUnreadQuery.queryKey, rows);

    const ids = new Set(rows.map((row) => row.id));
    if (known.current && !sameIds(known.current, ids)) {
      void queryClient.invalidateQueries({ queryKey: orpc.feed.list.key() });
    }
    known.current = ids;
  });
}

/** How many Activity items the viewer has not read, or 0 until the stream delivers. */
export function useFeedUnreadCount() {
  return (
    useQuery({ ...feedUnreadQuery, select: (rows) => rows.length }).data ?? 0
  );
}

function useUpdateFeedPages() {
  const queryClient = useQueryClient();

  return (read: boolean, ids?: readonly string[]) =>
    queryClient.setQueriesData<FeedPages>(
      { queryKey: orpc.feed.list.key() },
      (data) => setEntriesRead(data, read ? new Date() : null, ids)
    );
}

/** Sends `ids` in requests of at most `FEED_PAGE_MAX`, which is all one call takes. */
const inBatches = (ids: string[], send: (batch: string[]) => Promise<void>) =>
  Promise.all(
    Array.from({ length: Math.ceil(ids.length / FEED_PAGE_MAX) }, (_, i) =>
      send(ids.slice(i * FEED_PAGE_MAX, (i + 1) * FEED_PAGE_MAX))
    )
  );

/** Marks entries read. The dot goes at once, and the stream drops them from the badge. */
export function useMarkFeedRead() {
  const update = useUpdateFeedPages();

  return useMutation({
    mutationFn: (ids: string[]) =>
      inBatches(ids, (batch) => client.feed.markRead({ ids: batch })),
    onMutate: (ids) => update(true, ids),
  });
}

/** Marks entries unread. The dot comes back at once, and the stream adds them to the badge. */
export function useMarkFeedUnread() {
  const update = useUpdateFeedPages();

  return useMutation({
    mutationFn: (ids: string[]) =>
      inBatches(ids, (batch) => client.feed.markUnread({ ids: batch })),
    onMutate: (ids) => update(false, ids),
  });
}

export function useMarkAllFeedRead() {
  const update = useUpdateFeedPages();

  return useMutation({
    mutationFn: () => client.feed.markAllRead(),
    onSuccess: () => update(true),
  });
}

const needsRank = (entry: FeedEntry) =>
  !entry.readAt &&
  !entry.urgency &&
  (entry.kind === 'mention' || entry.kind === 'thread_reply');

/**
 * Asks the server to judge unread mentions and replies that have no urgency, once per mount, and reloads the
 * feed when it answers. The feed shows at once in rule order. A refusal or an outage changes nothing.
 */
export function useRankFeed(entries: readonly FeedEntry[], enabled: boolean) {
  const queryClient = useQueryClient();
  const asked = useRef(false);
  const unranked = enabled && entries.some(needsRank);

  useEffect(() => {
    if (!unranked || asked.current) return;
    asked.current = true;
    client.feed
      .rank()
      .then(() =>
        queryClient.invalidateQueries({ queryKey: orpc.feed.list.key() })
      )
      .catch(() => {});
  }, [unranked, queryClient]);
}
