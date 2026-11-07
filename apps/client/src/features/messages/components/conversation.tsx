'use client';

import { canChannel } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { ConversationSkeleton } from '@/components/conversation-skeleton';
import { sessionQuery } from '@/services/auth/queries';
import { useJoinChannel } from '@/services/channels/hooks';
import { channelMembersQuery, channelQuery } from '@/services/channels/queries';
import { useSendMessage } from '@/services/messages/hooks';
import { type LiveStatus, useLiveStream } from '@/services/messages/live';
import { flattenMessages, messagesQuery } from '@/services/messages/queries';
import {
  useWorkspaceMembers,
  useWorkspaceRole,
} from '@/services/workspaces/hooks';

import { MentionNames, MentionSuggestions } from '../context/mention-names';
import { useIsClient } from '../lib/use-is-client';
import { Composer } from './composer';
import { MessageList } from './message-list';
import type { Author } from './message-row';

const OFFLINE_AFTER_MS = 10_000;
// A normal connect takes a moment, so the line waits before it appears.
const CONNECTING_GRACE_MS = 2000;

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

/** The log and composer for one channel. A DM and a thread reuse these parts. */
export function Conversation({
  channelId,
  start,
}: {
  channelId: string;
  /** The opening block, shown once the log reaches its first message. */
  start: ReactNode;
}) {
  const isClient = useIsClient();
  const { data: channel } = useSuspenseQuery(channelQuery(channelId));
  const { data: session } = useQuery(sessionQuery);
  const { data: members } = useWorkspaceMembers();
  const { data: channelMembers } = useQuery(channelMembersQuery(channelId));
  const workspaceRole = useWorkspaceRole();
  const joinChannel = useJoinChannel();
  const history = useInfiniteQuery(messagesQuery(channelId));
  const liveStatus = useLiveStream(channelId);
  const { send, retry, discard } = useSendMessage(channelId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => flattenMessages(history.data), [history.data]);
  const viewerId = session?.user.id ?? null;

  const authors = useMemo(() => {
    const byId = new Map<string, Author>();
    for (const member of members ?? []) {
      byId.set(member.userId, { name: member.name, image: member.image });
    }
    return byId;
  }, [members]);
  const names = useMemo(
    () => new Map([...authors].map(([id, author]) => [id, author.name])),
    [authors]
  );

  const suggestions = useMemo(
    () => [
      { id: 'channel', name: 'channel', hint: 'Notify everyone here' },
      { id: 'here', name: 'here', hint: 'Notify members who are online' },
      ...(channelMembers ?? []).map(({ userId, name }) => ({
        id: userId,
        name,
      })),
    ],
    [channelMembers]
  );

  const lastOwn = messages
    .filter((message) => message.authorId === viewerId && !message.deletedAt)
    .at(-1);
  const canPost = canChannel('post', workspaceRole, channel);

  return (
    <MentionNames value={names}>
      <MentionSuggestions value={suggestions}>
        <div className="flex min-h-0 flex-1 flex-col">
          {isClient && !history.isPending ? (
            <MessageList
              channelId={channelId}
              messages={messages}
              authors={authors}
              viewerId={viewerId}
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
            />
          ) : (
            <ConversationSkeleton />
          )}
          <div ref={composerRef} className="px-4 pb-4 sm:px-5">
            <ConnectionLine status={liveStatus} />
            {channel.archivedAt ? null : canPost ? (
              <Composer
                placeholder={`Message #${channel.name}`}
                onSubmit={send}
                onEditLast={
                  lastOwn ? () => setEditingId(lastOwn.id) : undefined
                }
              />
            ) : (
              <div className="border-input flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <p className="text-muted-foreground text-sm">
                  Join #{channel.name} to send messages.
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
    </MentionNames>
  );
}
