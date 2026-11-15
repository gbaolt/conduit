'use client';

import { Button } from '@conduit/ui/components/button';
import { IconArrowLeft, IconMessageDots, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { Conversation } from '@/features/messages/components/conversation/conversation';
import { SummaryThreadMenu } from '@/features/messages/components/summary/summary-menu';
import { SummaryProvider } from '@/features/messages/context/summary';
import { useRoomName } from '@/features/messages/hooks/use-room-name';
import { threadRootQuery } from '@/services/messages/queries';

function ThreadRoomName({ roomId }: { roomId: string }) {
  const { title } = useRoomName(roomId);

  return (
    <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
      {title}
    </span>
  );
}

/** One thread: its root, the replies, and a composer that replies in it. */
export function ThreadPanel({
  roomId,
  threadId,
  onClose,
}: {
  /** The room the page shows. Without it the thread opens in the room its root belongs to. */
  roomId?: string;
  threadId: string;
  onClose: () => void;
}) {
  const root = useQuery(threadRootQuery(threadId));
  const room = roomId ?? root.data?.roomId;
  // A link can name a message that is gone, in another channel, or itself a reply.
  const missing =
    root.isError ||
    (root.data && (root.data.roomId !== room || root.data.parentId));

  return (
    <SummaryProvider target={{ kind: 'thread', messageId: threadId }}>
      <section
        aria-label="Thread"
        className="flex h-full min-h-0 flex-col"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) onClose();
        }}
      >
        <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to conversation"
            className="-ms-2 xl:hidden pointer-coarse:size-11"
            onClick={onClose}
          >
            <IconArrowLeft />
          </Button>
          <h2 className="ml-2 flex items-center gap-2 font-semibold">
            <IconMessageDots className="size-4" /> Thread
          </h2>
          {room ? (
            <ThreadRoomName roomId={room} />
          ) : (
            <span className="flex-1" />
          )}
          <SummaryThreadMenu />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close thread"
            className="max-xl:hidden pointer-coarse:size-11"
            onClick={onClose}
          >
            <IconX />
          </Button>
        </header>
        {missing ? (
          <p className="text-muted-foreground p-4 text-sm">
            This thread isn&apos;t available.
          </p>
        ) : (
          room && (
            <Conversation roomId={room} parentId={threadId} start={null} />
          )
        )}
      </section>
    </SummaryProvider>
  );
}
