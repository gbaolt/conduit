import { cookies } from 'next/headers';
import { type ReactNode, Suspense } from 'react';

import { ChannelPageSkeleton } from '@/features/channels/components/channel-skeletons';
import { ChannelDialogsProvider } from '@/features/channels/context/channel-dialogs-provider';
import {
  ChannelsNav,
  WorkspaceSidebar,
} from '@/features/workspace/components/workspace-sidebar';
import {
  LAYOUT_COOKIE,
  parseLayout,
} from '@/features/workspace/lib/layout-cookie';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelsQuery, dmsQuery } from '@/services/channels/queries';

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <ChannelDialogsProvider>
      <Suspense
        fallback={
          <WorkspaceSidebar
            defaultLayout={undefined}
            sidebar={<ChannelsNav loading />}
          >
            <ChannelPageSkeleton />
          </WorkspaceSidebar>
        }
      >
        <ChannelPanel>{children}</ChannelPanel>
      </Suspense>
    </ChannelDialogsProvider>
  );
}

async function ChannelPanel({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  const [, , cookieStore] = await Promise.all([
    client.prefetchQuery(channelsQuery),
    client.prefetchQuery(dmsQuery),
    cookies(),
  ]);

  return (
    <HydrateClient client={client}>
      <WorkspaceSidebar
        defaultLayout={parseLayout(cookieStore.get(LAYOUT_COOKIE)?.value)}
        sidebar={<ChannelsNav />}
      >
        {children}
      </WorkspaceSidebar>
    </HydrateClient>
  );
}
