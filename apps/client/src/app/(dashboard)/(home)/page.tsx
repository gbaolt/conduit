import { ORPCError } from '@orpc/client';
import { redirect } from 'next/navigation';

import { DefaultChannelRedirect } from '@/features/channels/components/default-channel-redirect';
import { getQueryClient } from '@/lib/query/hydration';
import { channelsQuery } from '@/services/channels/queries';

export default async function HomePage() {
  const channels = await getQueryClient()
    .fetchQuery(channelsQuery)
    .catch((error: unknown) => {
      // A fresh session has no active workspace yet; WorkspaceProvider sets one on the client.
      if (error instanceof ORPCError && error.code === 'FORBIDDEN') return [];
      throw error;
    });
  const defaultChannel = channels.find((channel) => channel.isDefault);

  if (defaultChannel) redirect(`/channels/${defaultChannel.id}`);

  return <DefaultChannelRedirect />;
}
