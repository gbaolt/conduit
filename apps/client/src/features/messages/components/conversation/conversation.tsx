'use client';

import { canChannel } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Checkbox } from '@conduit/ui/components/checkbox';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Label } from '@conduit/ui/components/label';
import { cn } from '@conduit/ui/lib/utils';
import { IconCloudOff } from '@tabler/icons-react';
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useRoomName } from '@/features/messages/hooks/use-room-name';
import { sessionQuery } from '@/services/auth/queries';
import { useJoinChannel } from '@/services/channels/hooks';
import { useSendMessage } from '@/services/messages/hooks';
import { type LiveStatus, useLiveStream } from '@/services/messages/live';
import {
  flattenMessages,
  messagesQuery,
  repliesQuery,
  threadRootQuery,
} from '@/services/messages/queries';
import { roomMembersQuery, roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import {
  MentionNames,
  MentionSuggestions,
  MentionViewer,
} from '../../context/mention-names';
import { useAuthors } from '../../hooks/use-authors';
import { useIsClient } from '../../hooks/use-is-client';
import { useNewMarker } from '../../hooks/use-new-marker';
import { SummaryDialog } from '../summary/summary-dialog';
import { ConversationComposer } from './conversation-composer';
import { ConversationLoading } from './conversation-loading';
import { ConversationMessages } from './conversation-messages';
import { ConversationTyping } from './conversation-typing';

const OFFLINE_AFTER_MS = 10_000;
// A normal connect takes a moment, so the line waits before it appears.
const CONNECTING_GRACE_MS = 2000;
const FOCUS_TINT_MS = 1500;

type ConversationKind = 'thread' | 'self' | 'dm' | 'channel';

function conversationKind(
  parentId: string | undefined,
  isDm: boolean,
  isSelf: boolean
): ConversationKind {
  if (parentId) return 'thread';
  if (isSelf) return 'self';
  return isDm ? 'dm' : 'channel';
}

const SHARE_LABELS: Record<ConversationKind, string> = {
  thread: 'Share to thread',
  self: 'Share to conversation',
  dm: 'Share to conversation',
  channel: 'Share to channel',
};

const PLACEHOLDERS: Record<ConversationKind, (title: string) => string> = {
  thread: () => 'Reply…',
  self: () => 'Jot a note…',
  dm: (title) => `Message ${title}`,
  channel: (title) => `Message ${title}`,
};

/** What sits under the log: nothing in an archived channel, a notice, the composer, or a prompt to join. */
function footerFor(
  archived: boolean,
  rootDeleted: boolean,
  canPost: boolean,
  canWrite: boolean
) {
  if (archived) return 'none';
  if (rootDeleted) return 'deleted';
  if (!canPost) return 'join';
  return canWrite ? 'composer' : 'restricted';
}

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
  roomId,
  parentId,
  start,
}: {
  roomId: string;
  parentId?: string;
  /** The opening block, shown once the log reaches its first message. */
  start: ReactNode;
}) {
  const isClient = useIsClient();
  const { data: channel } = useSuspenseQuery(roomQuery(roomId));
  const { data: session } = useQuery(sessionQuery);
  const { data: channelMembers } = useQuery(roomMembersQuery(roomId));
  const workspaceRole = useWorkspaceRole();
  const joinChannel = useJoinChannel();
  const { title, isDm, isSelf } = useRoomName(roomId);
  const history = useInfiniteQuery(
    parentId ? repliesQuery(parentId) : messagesQuery(roomId)
  );
  const rootQuery = useQuery({
    ...threadRootQuery(parentId ?? ''),
    enabled: Boolean(parentId),
  });
  const root = rootQuery.data;
  const liveStatus = useLiveStream(roomId, parentId);
  const { send, retry, discard } = useSendMessage(roomId, parentId);
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
  const linkedMessage = parentId || !threadParam ? messageParam : null;

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
    roomId,
    messages,
    viewerId: session?.user.id ?? null,
    // A thread has no read state of its own.
    ready: history.isSuccess && !parentId,
    hasOlder: history.hasNextPage,
  });
  const viewerId = session?.user.id ?? null;

  const { authorOf, names } = useAuthors();

  const canMentionEveryone = canChannel(
    'mentionEveryone',
    workspaceRole,
    channel
  );
  const suggestions = useMemo(
    () => [
      ...(isDm || !canMentionEveryone
        ? []
        : [
            { id: 'channel', name: 'channel', detail: 'Notify everyone here' },
            {
              id: 'here',
              name: 'here',
              detail: 'Notify members who are online',
            },
          ]),
      ...(channelMembers ?? []).map(({ userId, name, email, image }) => ({
        id: userId,
        name,
        detail: email,
        image,
        hint: userId === viewerId ? 'You' : undefined,
      })),
    ],
    [channelMembers, isDm, canMentionEveryone, viewerId]
  );

  const lastOwn = messages
    .filter((message) => message.authorId === viewerId && !message.deletedAt)
    .at(-1);
  const canPost = canChannel('post', workspaceRole, channel);
  const rootDeleted = Boolean(parentId && root?.deletedAt);
  const waitingForRoot = Boolean(parentId) && !root;
  // Shown from the first failed attempt, while the retries run, so a slow failure never looks like an empty log.
  const logFailed =
    (!history.data && Boolean(history.failureReason)) ||
    (waitingForRoot && Boolean(rootQuery.failureReason));
  const retryLog = () => {
    void history.refetch();
    if (parentId) void rootQuery.refetch();
  };
  const kind = conversationKind(parentId, isDm, isSelf);
  // Joined but held back by the channel's posting permissions: a new message or a reply.
  const canWrite = canChannel(
    parentId ? 'reply' : 'sendMessage',
    workspaceRole,
    channel
  );
  const canAlsoSend = canChannel('sendMessage', workspaceRole, channel);
  const footer = footerFor(
    Boolean(channel.archivedAt),
    rootDeleted,
    canPost,
    canWrite
  );

  return (
    <MentionNames value={names}>
      <MentionViewer value={viewerId}>
        <MentionSuggestions value={suggestions}>
          <div ref={frameRef} className="relative flex min-h-0 flex-1 flex-col">
            {isClient && history.data && !waitingForRoot ? (
              <ConversationMessages
                roomId={roomId}
                parentId={parentId}
                messages={messages}
                authorOf={authorOf}
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
                newMarkerId={markerId}
                onRead={markRead}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col pb-(--composer-height,8rem)">
                {isClient && logFailed ? (
                  <ConversationFailed
                    retrying={history.isFetching || rootQuery.isFetching}
                    onRetry={retryLog}
                  />
                ) : (
                  <ConversationLoading />
                )}
              </div>
            )}

            <ComposerFade />
            <SummaryDialog
              shareLabel={SHARE_LABELS[kind]}
              canShare={canPost}
              onSource={setScrollTarget}
            />

            <div
              ref={composerRef}
              className="absolute inset-x-0 bottom-0 z-20 px-4"
            >
              {history.isRefetchError && (
                <p
                  role="status"
                  className="text-muted-foreground flex items-center gap-1 pb-1 text-xs"
                >
                  Couldn’t refresh messages. Showing what’s saved.
                  <Button variant="link" size="xs" onClick={retryLog}>
                    Try again
                  </Button>
                </p>
              )}
              <ConnectionLine status={liveStatus} />
              {footer === 'deleted' && (
                <p className="text-muted-foreground text-sm">
                  The message that started this thread was deleted.
                </p>
              )}
              {footer === 'composer' && (
                <>
                  <ConversationComposer
                    roomId={roomId}
                    parentId={parentId}
                    placeholder={PLACEHOLDERS[kind](title)}
                    autoFocus={Boolean(parentId)}
                    onSubmit={(body) => {
                      send(body, alsoSend);
                      setAlsoSend(false);
                    }}
                    onEditLast={
                      lastOwn ? () => setEditingId(lastOwn.id) : undefined
                    }
                    actions={
                      parentId &&
                      canAlsoSend && (
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Checkbox
                            id={`also-send-${parentId}`}
                            checked={alsoSend}
                            onCheckedChange={setAlsoSend}
                          />
                          <Label
                            htmlFor={`also-send-${parentId}`}
                            title={`Also send to ${title}`}
                            className={cn(
                              'block truncate text-xs font-normal',
                              alsoSend
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            Also send to {title}
                          </Label>
                        </div>
                      )
                    }
                  />
                  <ConversationTyping roomId={roomId} parentId={parentId} />
                </>
              )}
              {footer === 'restricted' && (
                <p className="border-input text-muted-foreground rounded-lg border px-3 py-2 text-sm">
                  {parentId
                    ? `Only channel managers and admins can reply in threads in ${title}.`
                    : `Only channel managers and admins can post in ${title}.`}
                </p>
              )}
              {footer === 'join' && (
                <div className="border-input flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-sm">
                    Join {title} to send messages.
                  </p>
                  <Button
                    size="xs"
                    disabled={joinChannel.isPending}
                    onClick={() => joinChannel.mutate({ roomId })}
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

/** The log could not load. The composer stays below it, so a message can still be written and sent. */
function ConversationFailed({
  retrying,
  onRetry,
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Empty className="flex-1 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconCloudOff />
        </EmptyMedia>
        <EmptyTitle>Couldn’t load messages</EmptyTitle>
        <EmptyDescription>
          {retrying
            ? 'Trying again…'
            : 'Nothing is lost. Try again in a moment.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/** Messages fade out as they scroll under the composer, after giabao.dev's bottom fade, made taller. */
function ComposerFade() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
    >
      <div className="to-background h-15 bg-linear-to-b from-transparent mask-linear-[to_top,var(--background)_25%,transparent] backdrop-blur-[1px]" />
      <div className="bg-background h-[calc(var(--composer-height,8rem)-1rem)]" />
    </div>
  );
}
