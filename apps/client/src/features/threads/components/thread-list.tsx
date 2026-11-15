'use client';

import type { Thread } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@conduit/ui/components/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  IconHash,
  IconMessage,
  IconMessageReply,
  IconMessages,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useQueryState } from 'nuqs';

import { ListBackLink } from '@/components/list-view';
import { MessageExcerpt } from '@/features/messages/components/message/message-excerpt';
import { MentionNames } from '@/features/messages/context/mention-names';
import { useOpenThread } from '@/features/messages/context/thread';
import { useAuthors } from '@/features/messages/hooks/use-authors';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { dmsQuery } from '@/services/dms/queries';
import { threadRootQuery, threadsQuery } from '@/services/messages/queries';

import { participantsLabel } from '../lib/participants';
import { ThreadLayout } from './thread-layout';

function useThreadLabels(thread: Thread) {
  const { data: dms } = useQuery({
    ...dmsQuery,
    enabled: thread.channelName === null,
  });
  const { data: session } = useQuery(sessionQuery);
  const { names } = useAuthors();
  const viewerId = session?.user.id ?? '';

  const dm = dms?.find((item) => item.id === thread.root.roomId);
  const room =
    thread.channelName ?? (dm ? dmTitle(dm, viewerId) : 'Direct message');
  // Until the members load, a name would read "Former member".
  const participants =
    names.size > 0 &&
    participantsLabel(
      thread.participantIds,
      viewerId,
      (id) => names.get(id) ?? 'Former member'
    );
  return { room, participants };
}

/** A thread's root and newest replies. Replying opens the thread beside the list, so no composer loads here. */
function ThreadListItem({ thread, open }: { thread: Thread; open: boolean }) {
  const { authorOf } = useAuthors();
  const openThread = useOpenThread();
  const { room: label, participants } = useThreadLabels(thread);
  const { root, replies } = thread;
  const hidden = root.replyCount - replies.length;
  const isDm = thread.channelName === null;
  const queryClient = useQueryClient();
  const show = () => {
    // The panel opens on the root the list already holds, instead of a blank wait for its fetch.
    queryClient.setQueryData(
      threadRootQuery(root.id).queryKey,
      (cached) => cached ?? root
    );
    openThread?.(root.id);
  };

  return (
    <Card
      role="article"
      aria-label={`Thread in ${label}`}
      data-open={open || undefined}
      className="data-open:ring-ring/40 data-open:ring-3"
    >
      <CardHeader className="border-b">
        <CardTitle
          role="heading"
          aria-level={2}
          className="text-sm font-semibold"
        >
          <Link
            href={`${isDm ? '/dms' : '/channels'}/${root.roomId}?thread=${root.id}`}
            className="flex w-fit items-center gap-1 hover:underline"
          >
            {isDm ? (
              <IconMessage className="size-4" aria-hidden />
            ) : (
              <IconHash className="size-4" aria-hidden />
            )}
            {label}
          </Link>
        </CardTitle>
        {participants ? (
          <CardDescription className="text-xs">{participants}</CardDescription>
        ) : (
          <Skeleton className="h-4 w-20" />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MessageExcerpt message={root} author={authorOf(root.authorId)} />
        {hidden > 0 && (
          <Button
            variant="link"
            size="sm"
            className="text-link w-fit px-0"
            onClick={show}
          >
            Show {hidden} more {hidden === 1 ? 'reply' : 'replies'}
          </Button>
        )}
        {replies.map((reply) => (
          <MessageExcerpt
            key={reply.id}
            message={reply}
            author={authorOf(reply.authorId)}
          />
        ))}
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          data-thread-line={root.id}
          aria-pressed={open}
          onClick={show}
        >
          <IconMessageReply data-icon="inline-start" />
          Reply
        </Button>
      </CardFooter>
    </Card>
  );
}

function ThreadListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading threads"
      className="flex flex-col gap-4"
    >
      {['w-3/5', 'w-4/5'].map((width) => (
        <Card key={width}>
          <CardHeader className="border-b">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {['w-2/5', width].map((line) => (
              <div key={line} className="flex gap-3">
                <Skeleton className="size-9 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className={`h-3.5 ${line}`} />
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Skeleton className="h-7 w-20" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function ThreadListItems() {
  const { data: threads, isPending, isError, refetch } = useQuery(threadsQuery);
  const [openId] = useQueryState('thread');

  if (isPending) return <ThreadListSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn&apos;t load threads.{' '}
        <Button variant="link" size="xs" onClick={() => void refetch()}>
          Retry
        </Button>
      </p>
    );
  }
  if (threads.length === 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconMessages />
          </EmptyMedia>
          <EmptyTitle>No threads yet</EmptyTitle>
          <EmptyDescription>
            Threads you start or reply in show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {threads.map((thread) => (
        <li key={thread.root.id}>
          <ThreadListItem thread={thread} open={thread.root.id === openId} />
        </li>
      ))}
    </ul>
  );
}

/** Threads the member started or replied in, newest reply first. Each opens beside the list to reply. */
export function ThreadList() {
  const { names } = useAuthors();

  return (
    <ThreadLayout>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-4 py-1.5">
          <ListBackLink />
          <IconMessages className="size-4" aria-hidden />
          <h1 className="text-sm font-semibold">Threads</h1>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-5">
          <MentionNames value={names}>
            <ThreadListItems />
          </MentionNames>
        </div>
      </div>
    </ThreadLayout>
  );
}
