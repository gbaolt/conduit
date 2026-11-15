import { Suspense } from 'react';

import { DmHeader } from '@/features/dms/components/dm-header';
import { DmIntro } from '@/features/dms/components/dm-intro';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { PinnedButton } from '@/features/messages/components/pinned';
import { SummaryChannelItems } from '@/features/messages/components/summary/summary-menu';
import { RoomGuard } from '@/features/rooms/components/room-guard';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import { ThreadLayout } from '@/features/threads/components/thread-layout';
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

  // Not awaited: a DM the browser already holds renders at once, and these stream in behind it.
  const room = client.fetchQuery(roomQuery(roomId));
  void client.prefetchQuery(dmsQuery);
  void client.prefetchInfiniteQuery(messagesQuery(roomId));
  void client.prefetchQuery(pinnedQuery(roomId));

  return (
    <HydrateClient client={client}>
      <Suspense fallback={null}>
        <RoomGuard roomId={roomId} room={room} kind="dm" />
      </Suspense>
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
