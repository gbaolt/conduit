import { ORPCError } from '@orpc/client';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { ChannelHeader } from '@/features/channels/components/channel-header';
import { ChannelIntro } from '@/features/channels/components/channel-intro';
import { ChannelPageSkeleton } from '@/features/channels/components/channel-skeletons';
import { Conversation } from '@/features/messages/components/conversation';
import { PinnedButton } from '@/features/messages/components/pinned-list';
import { SummarizeChannelItems } from '@/features/messages/components/summarize-menu';
import { ThreadLayout } from '@/features/messages/components/thread-layout';
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
  const [channel] = await Promise.all([
    client.fetchQuery(channelQuery(channelId)).catch((error: unknown) => {
      if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }),
    client.prefetchInfiniteQuery(messagesQuery(channelId)),
    client.prefetchQuery(pinnedQuery(channelId)),
  ]);
  if (channel.kind === 'dm') redirect(`/dms/${channelId}`);

  return (
    <HydrateClient client={client}>
      <ThreadLayout channelId={channelId}>
        <div className="flex h-full min-h-0 flex-col">
          <ChannelHeader
            channelId={channelId}
            menu={<SummarizeChannelItems isDm={false} />}
          >
            <PinnedButton channelId={channelId} />
          </ChannelHeader>
          <Conversation
            key={channelId}
            channelId={channelId}
            start={<ChannelIntro channelId={channelId} />}
          />
        </div>
      </ThreadLayout>
    </HydrateClient>
  );
}
