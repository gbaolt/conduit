'use client';

import { Button } from '@conduit/ui/components/button';
import { IconArrowLeft, IconMessage, IconX } from '@tabler/icons-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { draftQuery } from '@/services/activity/queries';
import { messagesQuery } from '@/services/messages/queries';

import { useRoomName } from '../../hooks/use-room-name';
import { Conversation } from './conversation';
import { ConversationLoading } from './conversation-loading';

/** A whole room in the side card: its name, its log and a composer. `ThreadLayout` shows it for `?room=`. */
export function ConversationSplit({
  roomId,
  onClose,
}: {
  roomId: string;
  onClose: () => void;
}) {
  const { title, isDm } = useRoomName(roomId);
  // Start messages and draft before Conversation suspends on roomQuery for unseeded rooms.
  useInfiniteQuery(messagesQuery(roomId));
  useQuery(draftQuery(roomId));

  return (
    <section
      aria-label="Conversation"
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onClose();
      }}
    >
      <header className="flex min-h-12 shrink-0 items-center gap-2 border-b px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          className="-ms-2 xl:hidden pointer-coarse:size-11"
          onClick={onClose}
        >
          <IconArrowLeft />
        </Button>
        <h2 className="ml-2 flex min-w-0 flex-1 items-center gap-2 font-semibold">
          {isDm && <IconMessage className="size-4 shrink-0" aria-hidden />}
          <span className="truncate">{title}</span>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close conversation"
          className="max-xl:hidden pointer-coarse:size-11"
          onClick={onClose}
        >
          <IconX />
        </Button>
      </header>
      <Suspense fallback={<ConversationLoading />}>
        <Conversation roomId={roomId} start={null} />
      </Suspense>
    </section>
  );
}
