'use client';

import type { SavedMessage } from '@conduit/contract';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@conduit/ui/components/alert-dialog';
import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  IconBookmark,
  IconEraser,
  IconHash,
  IconMessage,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { StatusButton } from '@/components/async/status-button';
import { PageHeader } from '@/components/page-header';
import { MessageExcerpt } from '@/features/messages/components/message/message-excerpt';
import { MentionNames } from '@/features/messages/context/mention-names';
import { useAuthors } from '@/features/messages/hooks/use-authors';
import { useClearSaved } from '@/services/messages/hooks';
import { savedQuery } from '@/services/messages/queries';

import { SavedMessageActions } from './saved-message-actions';

function SavedItem({ item }: { item: SavedMessage }) {
  const { authorOf } = useAuthors();
  const { message, channelName } = item;

  return (
    <MessageExcerpt
      message={message}
      author={authorOf(message.authorId)}
      context={
        <Link
          href={`${channelName === null ? '/dms' : '/channels'}/${message.roomId}${
            message.parentId ? `?thread=${message.parentId}` : ''
          }`}
          className="text-link mb-0.5 flex w-fit items-center gap-0.5 text-xs hover:underline"
        >
          {channelName === null ? (
            <IconMessage className="size-3.5" aria-hidden />
          ) : (
            <IconHash className="size-3.5" aria-hidden />
          )}
          {channelName ?? 'Direct message'}
        </Link>
      }
      className="hover:bg-muted dark:hover:bg-muted/50 p-4"
    >
      <SavedMessageActions item={item} />
    </MessageExcerpt>
  );
}

function SavedClearButton() {
  const { data: items } = useQuery(savedQuery);
  const clear = useClearSaved();
  const [confirming, setConfirming] = useState(false);

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={!items?.length} />
        }
      >
        <IconEraser data-icon="inline-start" />
        Clear saved
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all saved messages?</AlertDialogTitle>
          <AlertDialogDescription>
            Every message you saved in this workspace leaves this list. The
            messages themselves stay where they were sent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <StatusButton
            variant="destructive"
            status={clear.isPending ? 'loading' : 'idle'}
            onClick={() =>
              clear.mutate(undefined, { onSuccess: () => setConfirming(false) })
            }
          >
            <IconEraser data-icon="inline-start" />
            Clear saved
          </StatusButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconBookmark />
          </EmptyMedia>
          <EmptyTitle>Nothing saved yet</EmptyTitle>
          <EmptyDescription>
            Use Save for later on a message, and it shows up here. Only you can
            see this list.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col gap-5">
      {items.map((item) => (
        <li key={item.message.id}>
          <SavedItem item={item} />
        </li>
      ))}
    </ul>
  );
}

/** Messages the member saved for later, newest first. Only the member sees them. Render it inside `ThreadLayout`, which shows a saved reply's thread, or a saved message's room, beside the list. */
export function SavedMessages() {
  const { names } = useAuthors();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader icon={IconBookmark} title="Saved" className="border-b">
        <SavedClearButton />
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-6 pb-10">
        <MentionNames value={names}>
          <SavedList />
        </MentionNames>
      </div>
    </div>
  );
}
