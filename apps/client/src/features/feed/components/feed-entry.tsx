'use client';

import {
  type FeedEntry as FeedEntryData,
  type FeedGroup,
  tierOf,
} from '@conduit/contract';
import { Checkbox } from '@conduit/ui/components/checkbox';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { cn } from '@conduit/ui/lib/utils';
import { IconSparkles } from '@tabler/icons-react';
import Link from 'next/link';

import { UserAvatar } from '@/components/user-avatar';
import { MessageTime } from '@/features/messages/components/message/message';
import { MessageMarkdown } from '@/features/messages/components/message/message-markdown';
import { useMarkFeedRead } from '@/services/feed/hooks';

import { feedEntryHref } from '../lib/feed-entry-href';
import { FEED_SOURCE_META } from '../lib/feed-sources';
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

/** Why the model ranked the item urgent. The sparkles mark it as AI's judgment, not a rule. */
function FeedEntryUrgency({ reason }: { reason: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium">
      <IconSparkles
        className="text-muted-foreground size-3.5 shrink-0"
        aria-hidden
      />
      <span className="sr-only">Urgent, judged by AI: </span>
      {reason}
    </p>
  );
}

/**
 * One Activity row, which is a group of one or more entries. The title is the row's link, stretched over
 * the whole row, so the row opens its newest entry with a click or Enter and marks the group read on the way.
 * The box before the avatar selects the row; it shows on hover, on focus, and while any row is selected, and
 * the unread dot holds its place otherwise. Shift-click selects the range from the last row picked.
 * `showUrgency` is off while AI is, so no AI judgment shows.
 */
export function FeedEntry({
  group,
  showUrgency,
  selected,
  onSelectedChange,
}: {
  group: FeedGroup;
  showUrgency: boolean;
  selected: boolean;
  onSelectedChange: (selected: boolean, range: boolean) => void;
}) {
  const markRead = useMarkFeedRead();
  const [entry] = group.entries;
  const unreadIds = group.entries.filter((e) => !e.readAt).map((e) => e.id);
  const unread = unreadIds.length > 0;
  const { message } = entry;
  const { Icon, label } = FEED_SOURCE_META[entry.kind];
  const actors = nameList(unique(group.entries.map((e) => e.actor.name)));

  return (
    <div
      data-selected={selected || undefined}
      className="group/feed-entry hover:bg-muted/60 data-selected:bg-muted relative flex gap-3 rounded-lg px-3 py-3 transition-colors"
    >
      <div className="relative z-10 mt-2.5 flex size-4 shrink-0 items-center justify-center">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full transition-opacity group-focus-within/feed-entry:opacity-0 group-hover/feed-entry:opacity-0 group-data-selecting/feed-list:opacity-0 pointer-coarse:opacity-0',
            unread ? 'bg-primary' : 'bg-transparent'
          )}
        />
        <Checkbox
          aria-label={`Select activity from ${actors}`}
          checked={selected}
          onCheckedChange={(checked, details) =>
            onSelectedChange(
              checked,
              (details.event as MouseEvent | undefined)?.shiftKey === true
            )
          }
          className="absolute inset-0 opacity-0 transition-opacity group-focus-within/feed-entry:opacity-100 group-hover/feed-entry:opacity-100 group-data-selecting/feed-list:opacity-100 data-checked:opacity-100 pointer-coarse:opacity-100"
        />
      </div>
      <div className="relative shrink-0 self-start">
        <UserAvatar
          name={entry.actor.name}
          image={entry.actor.image}
          className="size-9 rounded-md"
        />
        <span
          title={label}
          className="bg-background text-muted-foreground absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full"
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={feedEntryHref(entry)}
            data-feed-link
            onClick={() => {
              if (unread) markRead.mutate(unreadIds);
            }}
            className={cn(
              'focus-visible:after:ring-ring min-w-0 text-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2',
              !unread && 'text-muted-foreground'
            )}
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
        {showUrgency && tierOf(entry) === 'urgent' && entry.urgencyReason && (
          <FeedEntryUrgency reason={entry.urgencyReason} />
        )}
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
