import { Suspense } from 'react';

import { DmHeader } from '@/features/dms/components/dm-header';
import { DmIntro } from '@/features/dms/components/dm-intro';
import { DmName } from '@/features/dms/components/dm-name';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { PinnedButton } from '@/features/messages/components/pinned';
import { SummaryChannelItems } from '@/features/messages/components/summary/summary-menu';
import { RoomGate } from '@/features/rooms/components/room-gate';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import { ThreadLayout } from '@/features/threads/components/thread-layout';

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

  return (
    <RoomGate roomId={roomId} kind="dm" title={<DmName roomId={roomId} />}>
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
    </RoomGate>
  );
}
