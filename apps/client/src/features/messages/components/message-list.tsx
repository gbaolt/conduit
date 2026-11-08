'use client';

import type { Message } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerVisibility,
} from '@conduit/ui/components/message-scroller';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';

import { usePendingMessages } from '@/services/messages/hooks';

import { buildLog, dayLabel } from '../lib/group-messages';
import { type Author, MessageRow, PendingRow } from './message-row';

const UNKNOWN_AUTHOR: Author = { name: 'Former member', image: null };

function DayDivider({ date }: { date: Date }) {
  return (
    <div role="separator" className="flex items-center gap-3 px-5 pt-3 pb-1">
      <div className="bg-border h-px flex-1" />
      <span className="text-xs font-medium">{dayLabel(date, new Date())}</span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

function repliesLabel(count: number) {
  if (count === 0) return 'No replies yet';
  return count === 1 ? '1 reply' : `${count} replies`;
}

function ReplyDivider({ count }: { count: number }) {
  return (
    <div role="separator" className="flex items-center gap-3 px-5 pt-3 pb-1">
      <span className="text-muted-foreground text-xs font-medium">
        {repliesLabel(count)}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

function NewMarker() {
  return (
    <div
      role="separator"
      className="text-destructive flex items-center gap-3 px-5 pt-2 pb-1"
    >
      <div className="bg-destructive h-px flex-1" />
      <span className="text-xs font-medium">New</span>
    </div>
  );
}

/** Reports the newest message once the viewer has scrolled to it with the tab in front. */
function ReadThrough({
  newestId,
  onRead,
}: {
  newestId: string | undefined;
  onRead: ((messageId: string) => void) | undefined;
}) {
  const { visibleMessageIds } = useMessageScrollerVisibility();
  const atEnd = newestId !== undefined && visibleMessageIds.includes(newestId);

  useEffect(() => {
    if (!atEnd || !newestId || !onRead) return;

    const read = () => {
      if (document.visibilityState === 'visible') onRead(newestId);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [atEnd, newestId, onRead]);

  return null;
}

/** Loads the next older page once the oldest loaded message scrolls into view. */
function OlderPages({
  oldestId,
  enabled,
  onLoad,
}: {
  oldestId: string | undefined;
  enabled: boolean;
  onLoad: () => void;
}) {
  const { visibleMessageIds } = useMessageScrollerVisibility();
  const oldestVisible =
    oldestId !== undefined && visibleMessageIds.includes(oldestId);

  useEffect(() => {
    if (oldestVisible && enabled) onLoad();
  }, [oldestVisible, enabled, onLoad]);

  return null;
}

/**
 * Scrolls to the message a source link or permalink named. A message in an older page that is not loaded yet
 * is brought in by loading older pages until it shows up or none remain.
 */
function ScrollToTarget({
  target,
  loaded,
  canLoadOlder,
  onLoadOlder,
  onReached,
}: {
  target: string | null;
  loaded: boolean;
  canLoadOlder: boolean;
  onLoadOlder: () => void;
  onReached: (messageId: string | null) => void;
}) {
  const { scrollToMessage } = useMessageScroller();
  const loadOlder = useEffectEvent(onLoadOlder);
  const reached = useEffectEvent(onReached);

  useEffect(() => {
    if (!target) return;
    if (loaded) {
      scrollToMessage(target, {
        align: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
      reached(target);
    } else if (canLoadOlder) {
      loadOlder();
    } else {
      reached(null);
    }
  }, [target, loaded, canLoadOlder, scrollToMessage]);

  return null;
}

/** Up and Down move between rows. Escape hands focus back to the composer. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const row = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-message-row]'
  );
  if (!row || event.target !== row) return;

  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[data-message-row]')
  );
  const next = rows[rows.indexOf(row) + (event.key === 'ArrowUp' ? -1 : 1)];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

export function MessageList({
  channelId,
  parentId,
  messages,
  authors,
  viewerId,
  canPost,
  canModerate,
  start,
  hasOlder,
  loadingOlder,
  olderFailed,
  onLoadOlder,
  editingId,
  onEdit,
  onStopEditing,
  onEscape,
  retry,
  discard,
  scrollTarget,
  focusedId,
  onScrollReached,
  end,
  newMarkerId,
  onRead,
}: {
  channelId: string;
  /** Set when the list is a thread: `messages` then starts with its root. */
  parentId?: string;
  messages: readonly Message[];
  authors: ReadonlyMap<string, Author>;
  viewerId: string | null;
  canPost: boolean;
  canModerate: boolean;
  /** The conversation's opening block, shown once nothing older remains. */
  start: ReactNode;
  hasOlder: boolean;
  loadingOlder: boolean;
  olderFailed: boolean;
  onLoadOlder: () => void;
  editingId: string | null;
  onEdit: (messageId: string) => void;
  onStopEditing: () => void;
  onEscape: () => void;
  retry: (clientId: string) => void;
  discard: (clientId: string) => void;
  /** A message to scroll to, such as a summary's source. Older pages load until it is found. */
  scrollTarget: string | null;
  /** The message to tint, for 1.5 s after the scroll. */
  focusedId: string | null;
  /** Called once the target is on screen, or null when it cannot be found. */
  onScrollReached: (messageId: string | null) => void;
  /** After the last message, such as the summary card. */
  end?: ReactNode;
  /** The message the New marker sits above. */
  newMarkerId: string | null;
  /** Called with the newest message once the viewer has read to the end. */
  onRead: ((messageId: string) => void) | undefined;
}) {
  const pending = usePendingMessages(channelId, parentId);
  const entries = buildLog(messages, pending, viewerId ?? '', newMarkerId).map(
    (entry, index) =>
      // The divider after a thread's root ends its group.
      parentId && index === 1 ? { ...entry, grouped: false } : entry
  );
  const [mountedAt] = useState(() => Date.now());
  const viewer = authors.get(viewerId ?? '') ?? UNKNOWN_AUTHOR;

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport
          aria-label="Messages"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onEscape();
            else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              moveFocus(event);
            }
          }}
        >
          <MessageScrollerContent
            aria-live="polite"
            // The composer floats over the log, so the end of the log clears its height.
            className="gap-0 pt-2 pb-[calc(var(--composer-height,8rem)+0.75rem)]"
          >
            {olderFailed && (
              <p className="text-muted-foreground px-5 py-2 text-xs">
                Couldn&apos;t load earlier messages.{' '}
                <Button variant="link" size="xs" onClick={onLoadOlder}>
                  Retry
                </Button>
              </p>
            )}
            {!hasOlder && start}
            {entries.map((entry) => (
              <MessageScrollerItem
                key={entry.key}
                messageId={entry.key}
                // content-visibility clips paint to the row, so lift it while the action bar overlaps the row above.
                className="focus-within:relative focus-within:z-10 focus-within:[content-visibility:visible] hover:relative hover:z-10 hover:[content-visibility:visible] has-aria-expanded:relative has-aria-expanded:z-10 has-aria-expanded:[content-visibility:visible]"
              >
                {entry.startsDay && <DayDivider date={entry.createdAt} />}
                {entry.startsNew && <NewMarker />}
                {entry.kind === 'message' ? (
                  <MessageRow
                    message={entry.message}
                    author={authors.get(entry.authorId) ?? UNKNOWN_AUTHOR}
                    grouped={entry.grouped}
                    viewerId={viewerId}
                    canPost={canPost}
                    canModerate={canModerate}
                    fresh={entry.createdAt.getTime() > mountedAt}
                    focused={focusedId === entry.message.id}
                    editing={editingId === entry.message.id}
                    onEdit={() => onEdit(entry.message.id)}
                    onStopEditing={onStopEditing}
                    inThread={Boolean(parentId)}
                  />
                ) : (
                  <PendingRow
                    pending={entry.pending}
                    author={viewer}
                    grouped={entry.grouped}
                    onRetry={() => retry(entry.pending.clientId)}
                    onDiscard={() => discard(entry.pending.clientId)}
                  />
                )}
                {entry.kind === 'message' && entry.message.id === parentId && (
                  <ReplyDivider count={entry.message.replyCount} />
                )}
              </MessageScrollerItem>
            ))}
            {end}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className="data-[direction=end]:bottom-[calc(var(--composer-height,8rem)+0.5rem)]" />
        <ScrollToTarget
          target={scrollTarget}
          loaded={messages.some((message) => message.id === scrollTarget)}
          canLoadOlder={hasOlder && !loadingOlder && !olderFailed}
          onLoadOlder={onLoadOlder}
          onReached={onScrollReached}
        />
        <ReadThrough newestId={messages.at(-1)?.id} onRead={onRead} />
        <OlderPages
          oldestId={messages[0]?.id}
          enabled={hasOlder && !loadingOlder && !olderFailed}
          onLoad={onLoadOlder}
        />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
