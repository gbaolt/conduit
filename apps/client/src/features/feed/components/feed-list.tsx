'use client';

import type { FeedFilter } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconBell } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { type KeyboardEvent, useState } from 'react';

import { ListBackLink } from '@/components/list-view';
import { MentionNames } from '@/features/messages/context/mention-names';
import { useAuthors } from '@/features/messages/lib/use-authors';
import { useFeedUnreadCount, useMarkAllFeedRead } from '@/services/feed/hooks';
import { feedQuery } from '@/services/feed/queries';

import { CatchMeUp } from './catch-me-up';
import { FeedEntry } from './feed-entry';
import { FeedFilters } from './feed-filters';

function FeedListHeader() {
  return (
    <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-4 py-1.5">
      <ListBackLink />
      <IconBell className="size-4" aria-hidden />
      <h1 className="text-sm font-semibold">Activity</h1>
    </header>
  );
}

function FeedListRowsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading activity"
      className="flex max-w-2xl flex-col gap-5"
    >
      {['w-3/5', 'w-4/5', 'w-1/2'].map((width) => (
        <div key={width} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className={`h-3.5 ${width}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedListSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <FeedListHeader />
      <div className="px-4 py-4 sm:px-5">
        <FeedListRowsSkeleton />
      </div>
    </div>
  );
}

/** Up and Down move between entries. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  const links = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[data-feed-link]')
  );
  const index = links.indexOf(event.target as HTMLElement);
  const next = links[index + (event.key === 'ArrowUp' ? -1 : 1)];
  if (index >= 0 && next) {
    event.preventDefault();
    next.focus();
  }
}

function FeedEntries({ filter }: { filter: FeedFilter }) {
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(feedQuery(filter));

  if (isPending) return <FeedListRowsSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn&apos;t load activity.{' '}
        <Button variant="link" size="xs" onClick={() => void refetch()}>
          Retry
        </Button>
      </p>
    );
  }

  const entries = data.pages.flatMap((page) => page.entries);
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground max-w-sm text-sm">
        {filter === 'unread'
          ? 'You are all caught up.'
          : 'Nothing yet. Mentions, replies, reactions to your messages, and channel adds show up here.'}
      </p>
    );
  }

  return (
    <>
      <ul
        aria-label="Activity"
        className="-mx-3 flex max-w-2xl flex-col gap-0.5"
        onKeyDown={moveFocus}
      >
        {entries.map((entry) => (
          <li key={entry.id}>
            <FeedEntry entry={entry} />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load older
        </Button>
      )}
    </>
  );
}

/** The member's Activity, newest first, with its All and Unread filter. */
export function FeedList() {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const { names } = useAuthors();
  const unread = useFeedUnreadCount();
  const markAllRead = useMarkAllFeedRead();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FeedListHeader />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <CatchMeUp />
        <div className="mb-3 max-w-2xl">
          <FeedFilters
            filter={filter}
            onFilterChange={setFilter}
            canMarkAllRead={unread > 0 && !markAllRead.isPending}
            onMarkAllRead={() => markAllRead.mutate()}
          />
        </div>
        <MentionNames value={names}>
          <FeedEntries filter={filter} />
        </MentionNames>
      </div>
    </div>
  );
}
