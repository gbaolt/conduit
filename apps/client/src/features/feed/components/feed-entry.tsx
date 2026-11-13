'use client';

import type { FeedEntry as FeedEntryData } from '@conduit/contract';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { cn } from '@conduit/ui/lib/utils';
import Link from 'next/link';

import { UserAvatar } from '@/components/user-avatar';
import { MessageTime } from '@/features/messages/components/message/message';
import { MessageMarkdown } from '@/features/messages/components/message/message-markdown';
import { useMarkFeedRead } from '@/services/feed/hooks';

import { feedEntryHref } from '../lib/feed-entry-href';

const whenFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function roomLabel(room: FeedEntryData['room']) {
  return room.kind === 'dm' ? 'a direct message' : `#${room.name}`;
}

/** The sentence that names who did what, such as "Linh mentioned you in #design". */
function FeedEntryTitle({ entry }: { entry: FeedEntryData }) {
  const room = roomLabel(entry.room);
  const actor = (
    <span className={cn(!entry.readAt && 'font-semibold')}>
      {entry.actor.name}
    </span>
  );

  switch (entry.kind) {
    case 'mention':
      return (
        <>
          {actor} mentioned you in {room}
        </>
      );
    case 'thread_reply':
      return (
        <>
          {actor} replied in a thread in {room}
        </>
      );
    case 'reaction':
      return (
        <>
          {actor} reacted <Twemoji>{entry.emoji ?? ''}</Twemoji> to your message
          in {room}
        </>
      );
    case 'room_add':
      return (
        <>
          {actor} added you to {room}
        </>
      );
  }
}

/**
 * One Activity item. The title is the row's link, stretched over the whole row, so the row opens
 * with a click or Enter and marks itself read on the way.
 */
export function FeedEntry({ entry }: { entry: FeedEntryData }) {
  const markRead = useMarkFeedRead();
  const unread = !entry.readAt;
  const { message } = entry;

  return (
    <div className="hover:bg-muted/60 relative flex gap-3 rounded-lg px-3 py-3 transition-colors">
      <span
        aria-hidden
        className={cn(
          'mt-4 size-1.5 shrink-0 rounded-full',
          unread ? 'bg-primary' : 'bg-transparent'
        )}
      />
      <UserAvatar
        name={entry.actor.name}
        image={entry.actor.image}
        className="size-9 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={feedEntryHref(entry)}
            data-feed-link
            onClick={() => {
              if (unread) markRead.mutate([entry.id]);
            }}
            className="focus-visible:after:ring-ring min-w-0 text-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2"
          >
            {unread && <span className="sr-only">Unread. </span>}
            <FeedEntryTitle entry={entry} />
          </Link>
          <MessageTime
            date={entry.createdAt}
            format={whenFormat}
            className="shrink-0 text-xs"
          />
        </div>
        {message && (
          <div
            className={cn(
              'mt-1 max-h-[4.5rem] overflow-hidden text-sm',
              message.deletedAt && 'text-muted-foreground italic'
            )}
          >
            <MessageMarkdown
              id={message.id}
              updatedAt={entry.createdAt}
              body={message.body}
            />
          </div>
        )}
      </div>
    </div>
  );
}
