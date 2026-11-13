'use client';

import type { FeedEntry as FeedEntryData, FeedGroup } from '@conduit/contract';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { cn } from '@conduit/ui/lib/utils';
import Link from 'next/link';

import { UserAvatar } from '@/components/user-avatar';
import { MessageTime } from '@/features/messages/components/message/message';
import { MessageMarkdown } from '@/features/messages/components/message/message-markdown';
import { useMarkFeedRead } from '@/services/feed/hooks';

import { feedEntryHref } from '../lib/feed-entry-href';
import { nameList } from '../lib/name-list';

const whenFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function roomLabel(room: FeedEntryData['room']) {
  return room.kind === 'dm' ? 'a direct message' : `#${room.name}`;
}

const unique = <T,>(values: readonly T[]) => [...new Set(values)];

/** The sentence that names who did what, such as "Linh mentioned you in #design". A folded group names everyone. */
function FeedEntryTitle({ group }: { group: FeedGroup }) {
  const [entry] = group.entries;
  const room = roomLabel(entry.room);
  const unread = group.entries.some((e) => !e.readAt);
  const actor = (
    <span className={cn(unread && 'font-semibold')}>
      {nameList(unique(group.entries.map((e) => e.actor.name)))}
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
          {actor} reacted{' '}
          {unique(group.entries.map((e) => e.emoji ?? '')).map((emoji) => (
            <Twemoji key={emoji}>{emoji}</Twemoji>
          ))}{' '}
          to your message in {room}
        </>
      );
    case 'room_add':
      return (
        <>
          {actor} added you to{' '}
          {nameList(unique(group.entries.map((e) => roomLabel(e.room))))}
        </>
      );
  }
}

/**
 * One Activity row, which is a group of one or more entries. The title is the row's link, stretched over
 * the whole row, so the row opens its newest entry with a click or Enter and marks the group read on the way.
 */
export function FeedEntry({ group }: { group: FeedGroup }) {
  const markRead = useMarkFeedRead();
  const [entry] = group.entries;
  const unreadIds = group.entries.filter((e) => !e.readAt).map((e) => e.id);
  const unread = unreadIds.length > 0;
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
              if (unread) markRead.mutate(unreadIds);
            }}
            className="focus-visible:after:ring-ring min-w-0 text-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2"
          >
            {unread && <span className="sr-only">Unread. </span>}
            <FeedEntryTitle group={group} />
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
