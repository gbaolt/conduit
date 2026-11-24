import { Suspense } from 'react';

import { CanvasChannelTabs } from '@/features/canvases/components/canvas-channel-tab';
import { ChannelIntro } from '@/features/channels/components/channel-intro';
import { ChannelTitle } from '@/features/channels/components/channel-title';
import {
  ChannelArchivedBanner,
  ChannelHeader,
} from '@/features/channels/components/header/channel-header';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { PinnedButton } from '@/features/messages/components/pinned';
import { SummaryChannelItems } from '@/features/messages/components/summary/summary-menu';
import { RoomGate } from '@/features/rooms/components/room-gate';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import { ThreadLayout } from '@/features/threads/components/thread-layout';

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

  return (
    <RoomGate
      roomId={roomId}
      kind="channel"
      title={<ChannelTitle roomId={roomId} />}
    >
      <ThreadLayout roomId={roomId}>
        <div className="flex h-full min-h-0 flex-col">
          <ChannelHeader
            roomId={roomId}
            menu={<SummaryChannelItems isDm={false} />}
            showArchivedBanner={false}
          >
            <PinnedButton roomId={roomId} />
          </ChannelHeader>
          <CanvasChannelTabs
            roomId={roomId}
            banner={<ChannelArchivedBanner roomId={roomId} />}
          >
            <Conversation
              key={roomId}
              roomId={roomId}
              start={<ChannelIntro roomId={roomId} />}
            />
          </CanvasChannelTabs>
        </div>
      </ThreadLayout>
    </RoomGate>
  );
}
