import { Suspense } from 'react';

import { ChannelIntro } from '@/features/channels/components/channel-intro';
import { ChannelHeader } from '@/features/channels/components/header/channel-header';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { PinnedButton } from '@/features/messages/components/pinned';
import { SummaryChannelItems } from '@/features/messages/components/summary/summary-menu';
import { RoomGuard } from '@/features/rooms/components/room-guard';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import { ThreadLayout } from '@/features/threads/components/thread-layout';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { messagesQuery, pinnedQuery } from '@/services/messages/queries';
import { roomQuery } from '@/services/rooms/queries';

export default function ChannelPage({
  params,
}: PageProps<'/channels/[roomId]'>) {
  return (
    <Suspense fallback={<RoomPageSkeleton />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({
  params,
}: Omit<PageProps<'/channels/[roomId]'>, 'searchParams'>) {
  const { roomId } = await params;
  const client = getQueryClient();

  // Not awaited: a channel the browser already holds renders at once, and these stream in behind it.
  const room = client.fetchQuery(roomQuery(roomId));
  void client.prefetchInfiniteQuery(messagesQuery(roomId));
  void client.prefetchQuery(pinnedQuery(roomId));

  return (
    <HydrateClient client={client}>
      <Suspense fallback={null}>
        <RoomGuard roomId={roomId} room={room} kind="channel" />
      </Suspense>
      <ThreadLayout roomId={roomId}>
        <div className="flex h-full min-h-0 flex-col">
          <ChannelHeader
            roomId={roomId}
            menu={<SummaryChannelItems isDm={false} />}
          >
            <PinnedButton roomId={roomId} />
          </ChannelHeader>
          <Conversation
            key={roomId}
            roomId={roomId}
            start={<ChannelIntro roomId={roomId} />}
          />
        </div>
      </ThreadLayout>
    </HydrateClient>
  );
}
