'use client';

import {
  parseSearchQuery,
  type SearchFilter,
  type SearchOutput,
  withoutFilter,
} from '@conduit/contract';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@conduit/ui/components/tabs';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconAlertTriangle,
  IconSearch,
  IconSearchOff,
} from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import type { KeyboardEvent, ReactNode } from 'react';

import { FilesTable } from '@/features/files/components/files-list';
import { MentionNames } from '@/features/messages/context/mention-names';
import { useAuthors } from '@/features/messages/hooks/use-authors';
import { sessionQuery } from '@/services/auth/queries';
import { SEARCH_LIMIT, searchQuery } from '@/services/search/queries';

import { searchParams, type SearchTab } from '../lib/search-params';
import {
  HIT_ATTRIBUTE,
  SearchHitChannel,
  SearchHitMessage,
  SearchHitPerson,
} from './search-hit';

const TAB_LABELS: Record<SearchTab, string> = {
  messages: 'Messages',
  files: 'Files',
  channels: 'Channels',
  people: 'People',
};

// The filter to drop first when nothing matches: the one most likely to have hidden the result.
const NARROWEST: SearchFilter['key'][] = [
  'before',
  'after',
  'in',
  'from',
  'has',
];

const countLabel = (count: number) =>
  count >= SEARCH_LIMIT ? `${SEARCH_LIMIT}+` : String(count);

/** Up and down arrows walk the hits of a tab, as Tab would. */
function moveBetweenHits(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const hits = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(`[${HIT_ATTRIBUTE}]`),
  ];
  const index = hits.indexOf(document.activeElement as HTMLElement);
  if (index === -1) return;
  event.preventDefault();
  hits[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
}

function SearchState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: typeof IconSearch;
  title: string;
  children: ReactNode;
  action?: { label: ReactNode; onClick: () => void };
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
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

const MESSAGE_SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5'];

function ResultsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Searching"
      className="flex flex-col px-2 sm:px-4"
    >
      {MESSAGE_SKELETON_WIDTHS.map((width) => (
        <div key={width} className="flex gap-3 px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className={cn('h-4', width)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabResults({
  tab,
  data,
  terms,
}: {
  tab: SearchTab;
  data: SearchOutput;
  terms: string[];
}) {
  const { data: session } = useQuery(sessionQuery);
  switch (tab) {
    case 'messages':
      return data.messages.map((message) => (
        <SearchHitMessage key={message.id} message={message} terms={terms} />
      ));
    case 'files':
      return <FilesTable files={data.files} />;
    case 'channels':
      return data.channels.map((channel) => (
        <SearchHitChannel key={channel.id} channel={channel} />
      ));
    case 'people':
      return data.people.map((person) => (
        <SearchHitPerson
          key={person.id}
          person={person}
          isSelf={person.id === session?.user.id}
        />
      ));
  }
}

/** The results of `?q=`, a tab per kind with its count. The open tab lives in `?tab=`. */
export function SearchResults() {
  const [{ q, tab }, setParams] = useQueryStates(searchParams);
  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    ...searchQuery(q),
    placeholderData: keepPreviousData,
  });
  const { names } = useAuthors();
  const { terms, filters } = parseSearchQuery(q);
  const narrowest = NARROWEST.map((key) =>
    filters.find((filter) => filter.key === key)
  ).find(Boolean);

  let body: ReactNode;
  if (!q.trim()) {
    body = (
      <SearchState icon={IconSearch} title="Search your workspace">
        Find messages, files, channels, and people. Narrow it with{' '}
        <code>in:#channel</code>, <code>from:@person</code>,{' '}
        <code>has:file</code>, <code>before:2026-01-31</code>, or{' '}
        <code>after:2026-01-01</code>.
      </SearchState>
    );
  } else if (isPending) {
    body = <ResultsSkeleton />;
  } else if (isError) {
    body = (
      <SearchState
        icon={IconAlertTriangle}
        title="Couldn't search"
        action={{ label: 'Retry', onClick: () => void refetch() }}
      >
        Check your connection, then try again.
      </SearchState>
    );
  } else if ((tab === 'channels' || tab === 'people') && terms.length === 0) {
    body = (
      <SearchState icon={IconSearch} title={`Type a name to find ${tab}`}>
        Filters narrow messages and files. Channels and people match by name.
      </SearchState>
    );
  } else if (data[tab].length === 0) {
    body = (
      <SearchState
        icon={IconSearchOff}
        title={`No ${TAB_LABELS[tab].toLowerCase()} found`}
        action={
          narrowest && {
            label: (
              <>
                Try without <code>{narrowest.raw}</code>
              </>
            ),
            onClick: () =>
              void setParams({ q: withoutFilter(q, narrowest).trim() || null }),
          }
        }
      >
        {narrowest
          ? 'Nothing you can see matches all of these filters.'
          : 'Nothing you can see matches these words.'}
      </SearchState>
    );
  } else {
    body = (
      <div
        aria-busy={isPlaceholderData}
        onKeyDown={moveBetweenHits}
        className={cn(
          'flex flex-col px-2 transition-opacity sm:px-4',
          isPlaceholderData && 'opacity-60'
        )}
      >
        <TabResults tab={tab} data={data} terms={terms} />
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value: SearchTab) =>
        void setParams({ tab: value === 'messages' ? null : value })
      }
      className="min-h-0 flex-1 gap-0"
    >
      <div className="shrink-0 border-b px-4">
        <TabsList
          variant="line"
          aria-label="Result kinds"
          className="max-w-full [scrollbar-width:none] justify-start overflow-x-auto overflow-y-hidden"
        >
          {(Object.keys(TAB_LABELS) as SearchTab[]).map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="h-full flex-none translate-y-1 px-2 after:bottom-0!"
            >
              {TAB_LABELS[key]}
              {q.trim() && data && (
                <span className="text-muted-foreground tabular-nums">
                  {countLabel(data[key].length)}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {q.trim() && data?.indexed === false && (
        <Alert className="mx-4 mt-4 w-auto">
          <IconAlertTriangle />
          <AlertTitle>Word search is unavailable</AlertTitle>
          <AlertDescription>
            Channels, people, and filters still work. Messages and files that
            match your words can&apos;t be found right now.
          </AlertDescription>
        </Alert>
      )}
      <TabsContent
        value={tab}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2 pb-8"
      >
        <MentionNames value={names}>{body}</MentionNames>
      </TabsContent>
    </Tabs>
  );
}
