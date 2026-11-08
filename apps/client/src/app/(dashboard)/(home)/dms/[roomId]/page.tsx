import { ORPCError } from '@orpc/client';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { ChannelPageSkeleton } from '@/features/channels/components/channel-skeletons';
import { DmHeader } from '@/features/channels/components/header/dm-header';
import { DmIntro } from '@/features/channels/components/intro/dm-intro';
import { Conversation } from '@/features/messages/components/conversation/conversation';
import { PinnedButton } from '@/features/messages/components/pinned';
import { SummaryChannelItems } from '@/features/messages/components/summary/summary-menu';
import { ThreadLayout } from '@/features/messages/components/thread/thread-layout';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { dmsQuery, roomQuery } from '@/services/channels/queries';
import { messagesQuery, pinnedQuery } from '@/services/messages/queries';

export default function DmPage({ params }: PageProps<'/dms/[roomId]'>) {
  return (
    <Suspense fallback={<ChannelPageSkeleton />}>
      <Dm params={params} />
    </Suspense>
  );
}

async function Dm({
  params,
}: Omit<PageProps<'/dms/[roomId]'>, 'searchParams'>) {
  const { roomId } = await params;
  const client = getQueryClient();

  // A prefetch never throws: if the first page fails, the log loads in the browser instead.
  const [channel] = await Promise.all([
    client.fetchQuery(roomQuery(roomId)).catch((error: unknown) => {
      if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }),
    client.prefetchQuery(dmsQuery),
    client.prefetchInfiniteQuery(messagesQuery(roomId)),
    client.prefetchQuery(pinnedQuery(roomId)),
  ]);
  // A converted DM is a channel now.
  if (channel.kind !== 'dm') redirect(`/channels/${roomId}`);

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
