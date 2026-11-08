import { ORPCError } from '@orpc/client';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { ChannelIntro } from '@/features/channels/components/channel-intro';
import { ChannelHeader } from '@/features/channels/components/header/channel-header';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { PinnedButton } from '@/features/messages/components/pinned';
import { SummaryChannelItems } from '@/features/messages/components/summary/summary-menu';
import { ThreadLayout } from '@/features/messages/components/thread/thread-layout';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
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

  const [room] = await Promise.all([
    client.fetchQuery(roomQuery(roomId)).catch((error: unknown) => {
      if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }),
    client.prefetchInfiniteQuery(messagesQuery(roomId)),
    client.prefetchQuery(pinnedQuery(roomId)),
  ]);

  if (room.kind !== 'channel') redirect(`/dms/${roomId}`);

  return (
    <HydrateClient client={client}>
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
