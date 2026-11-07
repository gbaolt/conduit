import { ORPCError } from '@orpc/client';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ChannelHeader } from '@/features/channels/components/channel-header';
import { ChannelPageSkeleton } from '@/features/channels/components/channel-skeletons';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelQuery } from '@/services/channels/queries';

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

  await client.fetchQuery(channelQuery(channelId)).catch((error: unknown) => {
    if (error instanceof ORPCError && error.code === 'NOT_FOUND') notFound();
    throw error;
  });

  return (
    <HydrateClient client={client}>
      <ChannelHeader channelId={channelId} />
    </HydrateClient>
  );
}
