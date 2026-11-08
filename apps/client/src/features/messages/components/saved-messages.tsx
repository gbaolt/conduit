'use client';

import type { SavedMessage } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconBookmark, IconHash, IconMessage } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { BackToList } from '@/components/list-view';
import { useSavedMessage } from '@/services/messages/hooks';
import { savedQuery } from '@/services/messages/queries';

import { MentionNames } from '../context/mention-names';
import { useAuthors } from '../lib/use-authors';
import { MessageExcerpt } from './message/message-excerpt';

const FORMER_MEMBER = { name: 'Former member', image: null };

function SavedItem({ item }: { item: SavedMessage }) {
  const { authors } = useAuthors();
  const { saved, toggle } = useSavedMessage(item.message.id);
  const { message, channelName } = item;

  return (
    <MessageExcerpt
      message={message}
      author={authors.get(message.authorId) ?? FORMER_MEMBER}
      context={
        <Link
          href={`${channelName === null ? '/dms' : '/channels'}/${message.roomId}${
            message.parentId ? `?thread=${message.parentId}` : ''
          }`}
          className="text-primary mb-0.5 flex w-fit items-center gap-0.5 text-xs hover:underline"
        >
          {channelName === null ? (
            <IconMessage className="size-3.5" aria-hidden />
          ) : (
            <IconHash className="size-3.5" aria-hidden />
          )}
          {channelName ?? 'Direct message'}
        </Link>
      }
    >
      <Button
        variant="link"
        size="xs"
        className="px-0"
        disabled={!saved}
        onClick={toggle}
      >
        Remove from saved
      </Button>
    </MessageExcerpt>
  );
}

function SavedSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading saved messages"
      className="flex flex-col gap-5"
    >
      {['w-3/5', 'w-4/5', 'w-1/2'].map((width) => (
        <div key={width} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className={`h-3.5 ${width}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SavedList() {
  const { data: items, isPending, isError, refetch } = useQuery(savedQuery);

  if (isPending) return <SavedSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn&apos;t load saved messages.{' '}
        <Button variant="link" size="xs" onClick={() => void refetch()}>
          Retry
        </Button>
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground max-w-sm text-sm">
        Nothing saved yet. Use Save for later on a message, and it shows up
        here. Only you can see this list.
      </p>
    );
  }
  return (
    <ul className="flex max-w-2xl flex-col gap-5">
      {items.map((item) => (
        <li key={item.message.id}>
          <SavedItem item={item} />
        </li>
      ))}
    </ul>
  );
}

/** Messages the member saved for later, newest first. Only the member sees them. */
export function SavedMessages() {
  const { names } = useAuthors();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-4 py-1.5">
        <BackToList />
        <IconBookmark className="size-4" aria-hidden />
        <h1 className="text-sm font-semibold">Saved</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <MentionNames value={names}>
          <SavedList />
        </MentionNames>
      </div>
    </div>
  );
}
