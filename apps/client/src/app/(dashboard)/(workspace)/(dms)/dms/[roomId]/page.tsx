import { Suspense } from 'react';

import {
  CanvasDraftMenuItem,
  CanvasDraftProvider,
} from '@/features/canvases/components/canvas-draft-dialog';
import { CanvasRoomTabs } from '@/features/canvases/components/canvas-room-tabs';
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
      <CanvasDraftProvider>
        <ThreadLayout roomId={roomId} threadMenu={<CanvasDraftMenuItem />}>
          <div className="flex h-full min-h-0 flex-col">
            <DmHeader roomId={roomId} menu={<SummaryChannelItems isDm />}>
              <PinnedButton roomId={roomId} />
            </DmHeader>
            <CanvasRoomTabs roomId={roomId}>
              <Conversation
                key={roomId}
                roomId={roomId}
                start={<DmIntro roomId={roomId} />}
              />
            </CanvasRoomTabs>
          </div>
        </ThreadLayout>
      </CanvasDraftProvider>
    </RoomGate>
  );
}
