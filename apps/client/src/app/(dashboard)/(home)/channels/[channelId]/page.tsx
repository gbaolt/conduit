import { ORPCError } from '@orpc/client';
import { notFound } from 'next/navigation';

import { ChannelHeader } from '@/features/channels/components/channel-header';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelQuery } from '@/services/channels/queries';

export default async function ChannelPage({
  params,
}: PageProps<'/channels/[channelId]'>) {
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
