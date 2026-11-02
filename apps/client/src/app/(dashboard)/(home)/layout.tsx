import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { ChannelPanels } from '@/features/channels/components/channel-panels';
import { ChannelDialogsProvider } from '@/features/channels/context/channel-dialogs-provider';
import {
  LAYOUT_COOKIE,
  parseLayout,
} from '@/features/channels/lib/layout-cookie';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelsQuery } from '@/services/channels/queries';

export default async function HomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const client = getQueryClient();
  const [, cookieStore] = await Promise.all([
    client.prefetchQuery(channelsQuery),
    cookies(),
  ]);

  return (
    <HydrateClient client={client}>
      <ChannelDialogsProvider>
        <ChannelPanels
          defaultLayout={parseLayout(cookieStore.get(LAYOUT_COOKIE)?.value)}
        >
          {children}
        </ChannelPanels>
      </ChannelDialogsProvider>
    </HydrateClient>
  );
}
