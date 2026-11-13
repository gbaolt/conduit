'use client';

import { type FeedGroup, foldFeed, rankFeed } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconAlertTriangle,
  IconBell,
  IconChecks,
  IconFilter2,
  IconSearch,
  type TablerIcon,
} from '@tabler/icons-react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ListBackLink } from '@/components/list-view';
import { MentionNames } from '@/features/messages/context/mention-names';
import { useAuthors } from '@/features/messages/lib/use-authors';
import { useFeedUnreadCount, useRankFeed } from '@/services/feed/hooks';
import {
  type FeedListInput,
  feedQuery,
  normalizeSources,
} from '@/services/feed/queries';
import { useAiSettings } from '@/services/workspaces/hooks';

import { feedParams, type FeedSort } from '../lib/feed-params';
import { FEED_SOURCE_META } from '../lib/feed-sources';
import { sameSources, useFeedViews } from '../lib/feed-views';
import { CatchMeUp } from './catch-me-up';
import { FeedEntry } from './feed-entry';
import { FeedFilterPopover } from './feed-filter-popover';
import { FeedSearch } from './feed-search';
import { FeedToolbar } from './feed-toolbar';
import { FeedViewTabs } from './feed-view-tabs';

/** Tabs, toolbar, and rows share one gutter, so they share one left and one right edge. */
const column = 'w-full px-4 sm:px-5';

function FeedListHeader() {
  const unread = useFeedUnreadCount();

  return (
    <header className="flex min-h-12 shrink-0 items-center gap-2 px-4 py-1.5">
      <ListBackLink />
      <h1 className="text-sm font-semibold">Activity</h1>
      {unread > 0 && (
        <span className="text-muted-foreground text-xs tabular-nums">
          {unread} unread
        </span>
      )}
    </header>
  );
}

function FeedListRowsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading activity"
      className="flex flex-col gap-1"
    >
      {['w-3/5', 'w-4/5', 'w-1/2', 'w-2/3'].map((width) => (
        <div key={width} className="flex gap-3 px-3 py-3">
          <span className="size-4 shrink-0" />
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
      <div className="h-11 shrink-0 border-b" />
      <div className={cn(column, 'pt-14')}>
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

function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Picked rows, by group id. A change of filter clears them, since the rows they named are gone.
 * A shift pick selects every row between it and the last pick.
 */
function useSelection(groups: readonly FeedGroup[], filterKey: string) {
  const [picked, setPicked] = useState({ key: filterKey, ids: NO_IDS });
  const anchor = useRef<number | null>(null);
  const ids = picked.key === filterKey ? picked.ids : NO_IDS;
  const selected = groups.filter((group) => ids.has(group.id));

  const set = (next: Iterable<string>) =>
    setPicked({ key: filterKey, ids: new Set(next) });

  return {
    selected,
    isSelected: (group: FeedGroup) => ids.has(group.id),
    select: (next: FeedGroup[]) => {
      anchor.current = null;
      set(next.map((group) => group.id));
    },
    toggle: (index: number, on: boolean, range: boolean) => {
      const from = range && anchor.current !== null ? anchor.current : index;
      const span = groups
        .slice(Math.min(from, index), Math.max(from, index) + 1)
        .map((group) => group.id);
      anchor.current = index;
      set(on ? [...ids, ...span] : [...ids].filter((id) => !span.includes(id)));
    },
  };
}

/** A centered empty or error state: a glyph, a title, a sentence, and at most one action. */
function FeedListState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: TablerIcon;
  title: string;
  description: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Empty className="-mt-8 pt-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

/** Says why this filter shows nothing, and offers the way out when there is one. */
function FeedListEmpty({ input }: { input: FeedListInput }) {
  const [, setParams] = useQueryStates(feedParams);
  const q = input.q.trim();
  const sources = normalizeSources(input.sources);
  const [only] = sources;

  if (q) {
    return (
      <FeedListState
        icon={IconSearch}
        title="No results"
        description={<>Nothing in this view matches “{q}”.</>}
        action={{
          label: 'Clear search',
          onClick: () => void setParams({ q: null }),
        }}
      />
    );
  }
  if (input.filter === 'unread') {
    return (
      <FeedListState
        icon={IconChecks}
        title="You're all caught up"
        description="Nothing unread in this view."
        action={{
          label: 'Show read activity',
          onClick: () => void setParams({ unread: null }),
        }}
      />
    );
  }
  if (sources.length === 0) {
    return (
      <FeedListState
        icon={IconBell}
        title="No activity yet"
        description="Mentions, replies, reactions to your messages, and channel adds show up here."
      />
    );
  }
  return (
    <FeedListState
      icon={
        sources.length === 1 && only ? FEED_SOURCE_META[only].Icon : IconFilter2
      }
      title="Nothing here yet"
      description={`${sources
        .map((source) => FEED_SOURCE_META[source].label)
        .join(', ')} show up here.`}
    />
  );
}

/** The toolbar and the rows of one filter, with the rows' selection. `children` sit above the rows. */
function FeedListBody({
  input,
  sort,
  children,
}: {
  input: FeedListInput;
  sort: FeedSort;
  children?: ReactNode;
}) {
  const {
    data,
    isPending,
    isError,
    isPlaceholderData,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...feedQuery(input),
    placeholderData: keepPreviousData,
  });

  const aiEnabled = useAiSettings().data?.aiEnabled === true;
  const entries = useMemo(
    () => data?.pages.flatMap((page) => page.entries) ?? [],
    [data]
  );

  const groups = useMemo(() => {
    // With AI off, a judgment stored while it was on no longer ranks or shows.
    const folded = foldFeed(
      aiEnabled
        ? entries
        : entries.map((e) => ({
            ...e,
            urgency: undefined,
            urgencyReason: undefined,
          }))
    );
    return sort === 'smart' ? rankFeed(folded) : folded;
  }, [entries, sort, aiEnabled]);

  useRankFeed(entries, aiEnabled && sort === 'smart');
  const selection = useSelection(groups, JSON.stringify(input));

  let rows: ReactNode;
  if (isPending) rows = <FeedListRowsSkeleton />;
  else if (isError) {
    rows = (
      <FeedListState
        icon={IconAlertTriangle}
        title="Couldn't load activity"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  } else if (groups.length === 0) rows = <FeedListEmpty input={input} />;
  else {
    rows = (
      <>
        <ul
          aria-label="Activity"
          aria-busy={isPlaceholderData}
          data-selecting={selection.selected.length > 0 || undefined}
          className={cn(
            'group/feed-list flex flex-col gap-0.5 transition-opacity',
            isPlaceholderData && 'opacity-60'
          )}
          onKeyDown={moveFocus}
        >
          {groups.map((group, index) => (
            <li key={group.id}>
              <FeedEntry
                group={group}
                showUrgency={aiEnabled}
                selected={selection.isSelected(group)}
                onSelectedChange={(on, range) =>
                  selection.toggle(index, on, range)
                }
              />
            </li>
          ))}
        </ul>
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 ml-3"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            Load older
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <div className={cn(column, 'shrink-0')}>
        <FeedToolbar
          groups={groups}
          selected={selection.selected}
          onSelect={selection.select}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
        <div className={cn(column, 'flex flex-1 flex-col')}>
          {children}
          <div className="-mx-3 flex flex-1 flex-col">{rows}</div>
        </div>
      </div>
    </>
  );
}

/**
 * The member's Activity: a tab per view, a sources filter that saves custom views, a search, and rows the
 * member can select and mark read or unread. Every filter lives in the URL through `feedParams`.
 */
export function FeedList() {
  const [{ show, unread, sort, q }] = useQueryStates(feedParams);
  const views = useFeedViews();
  const active = views.views.find((view) => sameSources(view.sources, show));
  const search = useDebouncedValue(q, 250);
  const { names } = useAuthors();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FeedListHeader />
      <div className="shrink-0 border-b">
        <div className={column}>
          <FeedViewTabs views={views.views} active={active}>
            <FeedSearch />
            <FeedFilterPopover active={active} views={views} />
          </FeedViewTabs>
        </div>
      </div>
      <MentionNames value={names}>
        <FeedListBody
          input={{
            filter: unread ? 'unread' : 'all',
            sources: show,
            q: search,
          }}
          sort={sort}
        >
          <CatchMeUp />
        </FeedListBody>
      </MentionNames>
    </div>
  );
}
