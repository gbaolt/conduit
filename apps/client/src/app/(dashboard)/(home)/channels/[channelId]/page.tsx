import { ORPCError } from '@orpc/client';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ChannelHeader } from '@/features/channels/components/channel-header';
import { ChannelIntro } from '@/features/channels/components/channel-intro';
import { ChannelPageSkeleton } from '@/features/channels/components/channel-skeletons';
import { Conversation } from '@/features/messages/components/conversation';
import { PinnedButton } from '@/features/messages/components/pinned-list';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelQuery } from '@/services/channels/queries';
import { messagesQuery, pinnedQuery } from '@/services/messages/queries';

export default function ChannelPage({
  params,
}: PageProps<'/channels/[channelId]'>) {
  return (
    <Suspense fallback={<ChannelPageSkeleton />}>
      <Channel params={params} />
    </Suspense>
  );
}

async function Channel({
  params,
}: Omit<PageProps<'/channels/[channelId]'>, 'searchParams'>) {
  const { channelId } = await params;
  const client = getQueryClient();

  // A prefetch never throws: if the first page fails, the log loads in the browser instead.
  await Promise.all([
    client.fetchQuery(channelQuery(channelId)).catch((error: unknown) => {
      if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }),
    client.prefetchInfiniteQuery(messagesQuery(channelId)),
    client.prefetchQuery(pinnedQuery(channelId)),
  ]);

  return (
    <HydrateClient client={client}>
      <div className="flex h-full min-h-0 flex-col">
        <ChannelHeader channelId={channelId}>
          <PinnedButton channelId={channelId} />
        </ChannelHeader>
        <Conversation
          channelId={channelId}
          start={<ChannelIntro channelId={channelId} />}
        />
      </div>
    </HydrateClient>
  );
}
