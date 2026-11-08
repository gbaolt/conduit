import { ORPCError } from '@orpc/client';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { DmHeader } from '@/features/dms/components/dm-header';
import { DmIntro } from '@/features/dms/components/dm-intro';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { PinnedButton } from '@/features/messages/components/pinned';
import { SummaryChannelItems } from '@/features/messages/components/summary/summary-menu';
import { ThreadLayout } from '@/features/messages/components/thread/thread-layout';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { dmsQuery } from '@/services/dms/queries';
import { messagesQuery, pinnedQuery } from '@/services/messages/queries';
import { roomQuery } from '@/services/rooms/queries';

export default function DmPage({ params }: PageProps<'/dms/[roomId]'>) {
  return (
    <Suspense fallback={<RoomPageSkeleton />}>
      <Dm params={params} />
    </Suspense>
  );
}

async function Dm({
  params,
}: Omit<PageProps<'/dms/[roomId]'>, 'searchParams'>) {
  const { roomId } = await params;
  const client = getQueryClient();

  const [room] = await Promise.all([
    client.fetchQuery(roomQuery(roomId)).catch((error: unknown) => {
      if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }),
    client.prefetchQuery(dmsQuery),
    client.prefetchInfiniteQuery(messagesQuery(roomId)),
    client.prefetchQuery(pinnedQuery(roomId)),
  ]);

  if (room.kind !== 'dm') redirect(`/channels/${roomId}`);

  return (
    <HydrateClient client={client}>
      <ThreadLayout roomId={roomId}>
        <div className="flex h-full min-h-0 flex-col">
          <DmHeader roomId={roomId} menu={<SummaryChannelItems isDm />}>
            <PinnedButton roomId={roomId} />
          </DmHeader>
          <Conversation
            key={roomId}
            roomId={roomId}
            start={<DmIntro roomId={roomId} />}
          />
        </div>
      </ThreadLayout>
    </HydrateClient>
  );
}
