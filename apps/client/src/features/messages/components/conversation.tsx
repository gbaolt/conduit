'use client';

import { canChannel } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Checkbox } from '@conduit/ui/components/checkbox';
import { Label } from '@conduit/ui/components/label';
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { ConversationSkeleton } from '@/components/conversation-skeleton';
import { sessionQuery } from '@/services/auth/queries';
import { useConversationName, useJoinChannel } from '@/services/channels/hooks';
import { channelMembersQuery, channelQuery } from '@/services/channels/queries';
import { useSendMessage } from '@/services/messages/hooks';
import { type LiveStatus, useLiveStream } from '@/services/messages/live';
import {
  flattenMessages,
  messagesQuery,
  repliesQuery,
  threadRootQuery,
} from '@/services/messages/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import {
  MentionNames,
  MentionSuggestions,
  MentionViewer,
} from '../context/mention-names';
import { useAuthors } from '../lib/use-authors';
import { useIsClient } from '../lib/use-is-client';
import { useNewMarker } from '../lib/use-new-marker';
import { ConversationComposer } from './conversation-composer';
import { MessageList } from './message-list';
import { SummaryCard } from './summary-card';
import { TypingLine } from './typing-line';

const OFFLINE_AFTER_MS = 10_000;
// A normal connect takes a moment, so the line waits before it appears.
const CONNECTING_GRACE_MS = 2000;
const FOCUS_TINT_MS = 1500;

/** True once `active` has held for `ms`. */
function useHeldFor(active: boolean, ms: number) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setHeld(true), ms);
    return () => {
      clearTimeout(timer);
      setHeld(false);
    };
  }, [active, ms]);

  return held;
}

function ConnectionLine({ status }: { status: LiveStatus }) {
  const notLive = status !== 'live';
  const showing = useHeldFor(notLive, CONNECTING_GRACE_MS);
  const offline = useHeldFor(notLive, OFFLINE_AFTER_MS);

  if (!notLive || !showing) return null;

  return (
    <p role="status" className="text-muted-foreground pb-1 text-xs">
      {offline
        ? 'Offline. Messages will send when you reconnect.'
        : 'Reconnecting…'}
    </p>
  );
}

/**
 * The log and composer for one channel. A DM reuses them as they are. With `parentId` they show that
 * thread instead: the root message, its replies, and a composer that replies.
 */
export function Conversation({
  channelId,
  parentId,
  start,
}: {
  channelId: string;
  parentId?: string;
  /** The opening block, shown once the log reaches its first message. */
  start: ReactNode;
}) {
  const isClient = useIsClient();
  const { data: channel } = useSuspenseQuery(channelQuery(channelId));
  const { data: session } = useQuery(sessionQuery);
  const { data: channelMembers } = useQuery(channelMembersQuery(channelId));
  const workspaceRole = useWorkspaceRole();
  const joinChannel = useJoinChannel();
  const { title, isDm, isSelf } = useConversationName(channelId);
  const history = useInfiniteQuery(
    parentId ? repliesQuery(parentId) : messagesQuery(channelId)
  );
  const { data: root } = useQuery({
    ...threadRootQuery(parentId ?? ''),
    enabled: Boolean(parentId),
  });
  const liveStatus = useLiveStream(channelId, parentId);
  const { send, retry, discard } = useSendMessage(channelId, parentId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alsoSend, setAlsoSend] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // The log pads its end and lifts its jump button by the composer's height, which grows with a long draft.
  useEffect(() => {
    const composer = composerRef.current;
    const frame = frameRef.current;
    if (!composer || !frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const height =
        entry?.borderBoxSize[0]?.blockSize ?? composer.offsetHeight;
      frame.style.setProperty('--composer-height', `${height}px`);
    });
    observer.observe(composer);
    return () => observer.disconnect();
  }, []);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // A shared summary links its sources as `?message=`. A thread's links also carry `?thread=`, which only the thread's own log follows.
  const [messageParam, setMessageParam] = useQueryState('message');
  const [threadParam] = useQueryState('thread');
  const linkedMessage = parentId
    ? messageParam
    : threadParam
      ? null
      : messageParam;
  useEffect(() => {
    if (!linkedMessage) return;
    setScrollTarget(linkedMessage);
    void setMessageParam(null);
  }, [linkedMessage, setMessageParam]);

  useEffect(() => {
    if (!focusedId) return;
    const timer = setTimeout(() => setFocusedId(null), FOCUS_TINT_MS);
    return () => clearTimeout(timer);
  }, [focusedId]);

  const messages = useMemo(() => {
    const loaded = flattenMessages(history.data);
    // A deleted root stays visible even with no replies left, so the thread still says what it was.
    return parentId && root ? [root, ...loaded] : loaded;
  }, [history.data, parentId, root]);
  const { markerId, markRead } = useNewMarker({
    channelId,
    messages,
    viewerId: session?.user.id ?? null,
    // A thread has no read state of its own.
    ready: history.isSuccess && !parentId,
    hasOlder: history.hasNextPage,
  });
  const viewerId = session?.user.id ?? null;

  const { authors, names } = useAuthors();

  const suggestions = useMemo(
    () => [
      ...(isDm
        ? []
        : [
            { id: 'channel', name: 'channel', hint: 'Notify everyone here' },
            {
              id: 'here',
              name: 'here',
              hint: 'Notify members who are online',
            },
          ]),
      ...(channelMembers ?? []).map(({ userId, name }) => ({
        id: userId,
        name,
      })),
    ],
    [channelMembers, isDm]
  );

  const lastOwn = messages
    .filter((message) => message.authorId === viewerId && !message.deletedAt)
    .at(-1);
  const canPost = canChannel('post', workspaceRole, channel);
  const rootDeleted = Boolean(parentId && root?.deletedAt);
  const waitingForRoot = Boolean(parentId) && !root;

  return (
    <MentionNames value={names}>
      <MentionViewer value={viewerId}>
        <MentionSuggestions value={suggestions}>
          <div ref={frameRef} className="relative flex min-h-0 flex-1 flex-col">
            {isClient && !history.isPending && !waitingForRoot ? (
              <MessageList
                channelId={channelId}
                parentId={parentId}
                messages={messages}
                authors={authors}
                viewerId={viewerId}
                canPost={canPost}
                canModerate={canChannel(
                  'deleteOthersMessages',
                  workspaceRole,
                  channel
                )}
                start={start}
                hasOlder={history.hasNextPage}
                loadingOlder={history.isFetchingNextPage}
                olderFailed={history.isFetchNextPageError}
                onLoadOlder={() => void history.fetchNextPage()}
                editingId={editingId}
                onEdit={setEditingId}
                onStopEditing={() => setEditingId(null)}
                onEscape={() =>
                  composerRef.current
                    ?.querySelector<HTMLElement>('[contenteditable="true"]')
                    ?.focus()
                }
                retry={retry}
                discard={discard}
                scrollTarget={scrollTarget}
                focusedId={focusedId}
                onScrollReached={(messageId) => {
                  setScrollTarget(null);
                  setFocusedId(messageId);
                }}
                end={
                  <SummaryCard
                    shareLabel={
                      parentId
                        ? 'Share to thread'
                        : isDm
                          ? 'Share to conversation'
                          : 'Share to channel'
                    }
                    canShare={canPost}
                    onSource={setScrollTarget}
                  />
                }
                newMarkerId={markerId}
                onRead={markRead}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col pb-(--composer-height,8rem)">
                <ConversationSkeleton />
              </div>
            )}
            <ComposerFade />
            <div
              ref={composerRef}
              className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-5"
            >
              <ConnectionLine status={liveStatus} />
              {channel.archivedAt ? null : rootDeleted ? (
                <p className="text-muted-foreground text-sm">
                  The message that started this thread was deleted.
                </p>
              ) : canPost ? (
                <>
                  <ConversationComposer
                    channelId={channelId}
                    parentId={parentId}
                    placeholder={
                      parentId
                        ? 'Reply…'
                        : isSelf
                          ? 'Jot a note…'
                          : `Message ${title}`
                    }
                    autoFocus={Boolean(parentId)}
                    onSubmit={(body) => {
                      send(body, alsoSend);
                      setAlsoSend(false);
                    }}
                    onEditLast={
                      lastOwn ? () => setEditingId(lastOwn.id) : undefined
                    }
                  >
                    {parentId && (
                      <div className="flex items-center gap-2 pt-2">
                        <Checkbox
                          id={`also-send-${parentId}`}
                          checked={alsoSend}
                          onCheckedChange={setAlsoSend}
                        />
                        <Label
                          htmlFor={`also-send-${parentId}`}
                          className="text-muted-foreground text-xs font-normal"
                        >
                          Also send to {title}
                        </Label>
                      </div>
                    )}
                  </ConversationComposer>
                  <TypingLine channelId={channelId} parentId={parentId} />
                </>
              ) : (
                <div className="border-input flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-sm">
                    Join {title} to send messages.
                  </p>
                  <Button
                    size="xs"
                    disabled={joinChannel.isPending}
                    onClick={() => joinChannel.mutate({ channelId })}
                  >
                    Join channel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </MentionSuggestions>
      </MentionViewer>
    </MentionNames>
  );
}

/** Messages fade out as they scroll under the composer, after giabao.dev's bottom fade, made taller. */
function ComposerFade() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
    >
      <div className="to-background h-32 bg-linear-to-b from-transparent mask-linear-[to_top,var(--background)_25%,transparent] backdrop-blur-[1px]" />
      <div className="bg-background h-[calc(var(--composer-height,8rem)-1rem)]" />
    </div>
  );
}
