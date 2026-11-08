import { ORPCError } from '@orpc/client';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { ChannelPageSkeleton } from '@/features/channels/components/channel-skeletons';
import { DmHeader } from '@/features/channels/components/dm-header';
import { DmIntro } from '@/features/channels/components/dm-intro';
import { Conversation } from '@/features/messages/components/conversation';
import { PinnedButton } from '@/features/messages/components/pinned-list';
import { SummarizeChannelItems } from '@/features/messages/components/summarize-menu';
import { ThreadLayout } from '@/features/messages/components/thread-layout';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelQuery, dmsQuery } from '@/services/channels/queries';
import { messagesQuery, pinnedQuery } from '@/services/messages/queries';

export default function DmPage({ params }: PageProps<'/dms/[channelId]'>) {
  return (
    <Suspense fallback={<ChannelPageSkeleton />}>
      <Dm params={params} />
    </Suspense>
  );
}

async function Dm({
  params,
}: Omit<PageProps<'/dms/[channelId]'>, 'searchParams'>) {
  const { channelId } = await params;
  const client = getQueryClient();

  // A prefetch never throws: if the first page fails, the log loads in the browser instead.
  const [channel] = await Promise.all([
    client.fetchQuery(channelQuery(channelId)).catch((error: unknown) => {
      if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }),
    client.prefetchQuery(dmsQuery),
    client.prefetchInfiniteQuery(messagesQuery(channelId)),
    client.prefetchQuery(pinnedQuery(channelId)),
  ]);
  // A converted DM is a channel now.
  if (channel.kind !== 'dm') redirect(`/channels/${channelId}`);

  return (
    <HydrateClient client={client}>
      <ThreadLayout channelId={channelId}>
        <div className="flex h-full min-h-0 flex-col">
          <DmHeader channelId={channelId} menu={<SummarizeChannelItems isDm />}>
            <PinnedButton channelId={channelId} />
          </DmHeader>
          <Conversation
            key={channelId}
            channelId={channelId}
            start={<DmIntro channelId={channelId} />}
          />
        </div>
      </ThreadLayout>
    </HydrateClient>
  );
}
