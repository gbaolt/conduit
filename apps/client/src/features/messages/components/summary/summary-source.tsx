'use client';

import type { Message } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';

import { threadRootQuery } from '@/services/messages/queries';

import { useRoomName } from '../../lib/use-room-name';

/** The cited message's own conversation, with `?thread=` for a reply and `?message=` to scroll to it. */
function SummarySourceLink({
  message,
  number,
}: {
  message: Message;
  number: number;
}) {
  const { title, isDm } = useRoomName(message.roomId);
  const params = new URLSearchParams();
  if (message.parentId) params.set('thread', message.parentId);
  params.set('message', message.id);

  return (
    <Button
      size="xs"
      variant="link"
      nativeButton={false}
      aria-label={`Source ${number}${title ? ` in ${title}` : ''}`}
      className="pointer-coarse:inline-block pointer-coarse:min-h-11"
      render={
        <Link
          href={
            `${isDm ? '/dms' : '/channels'}/${message.roomId}?${params}` as Route
          }
        />
      }
    >
      {number}
      {title && (
        <span className="text-muted-foreground font-normal"> · {title}</span>
      )}
    </Button>
  );
}

/** A catch-up cites messages from many rooms, so a source opens in its own room and names it. */
export function SummarySource({
  messageId,
  number,
}: {
  messageId: string;
  number: number;
}) {
  const { data: message } = useQuery(threadRootQuery(messageId));
  if (!message) {
    return (
      <span className="text-muted-foreground px-2 text-xs tabular-nums">
        {number}
      </span>
    );
  }
  return <SummarySourceLink message={message} number={number} />;
}
