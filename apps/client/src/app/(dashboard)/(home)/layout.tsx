import { cookies } from 'next/headers';
import { type ReactNode, Suspense } from 'react';

import { ChannelGroups } from '@/features/channels/components/sidebar/channel-groups';
import { ChannelGroupsSkeleton } from '@/features/channels/components/sidebar/channel-groups-skeleton';
import { ChannelDialogsProvider } from '@/features/channels/context/channel-dialogs-provider';
import { DmGroup } from '@/features/dms/components/dm-group';
import { DmDialogsProvider } from '@/features/dms/context/dm-dialogs-provider';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import {
  WorkspaceSidebar,
  WorkspaceSidebarMain,
  WorkspaceSidebarNav,
  WorkspaceSidebarPanel,
} from '@/features/workspace/components/workspace-sidebar';
import { WorkspaceHeader } from '@/features/workspace/components/workspace-sidebar/workspace-header';
import { WorkspaceNav } from '@/features/workspace/components/workspace-sidebar/workspace-nav';
import {
  LAYOUT_COOKIE,
  parseLayout,
} from '@/features/workspace/lib/layout-cookie';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelsQuery } from '@/services/channels/queries';
import { dmsQuery } from '@/services/dms/queries';
import { membersQuery } from '@/services/workspaces/queries';

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <ChannelDialogsProvider>
      <DmDialogsProvider>
        <Suspense
          fallback={
            <WorkspaceSidebar defaultLayout={undefined}>
              <WorkspaceSidebarPanel>
                <WorkspaceSidebarNav aria-label="Channels">
                  <WorkspaceHeader />
                  <WorkspaceNav />
                  <ChannelGroupsSkeleton />
                </WorkspaceSidebarNav>
              </WorkspaceSidebarPanel>
              <WorkspaceSidebarMain>
                <RoomPageSkeleton />
              </WorkspaceSidebarMain>
            </WorkspaceSidebar>
          }
        >
          <RoomPanel>{children}</RoomPanel>
        </Suspense>
      </DmDialogsProvider>
    </ChannelDialogsProvider>
  );
}

async function RoomPanel({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  const [, , , cookieStore] = await Promise.all([
    client.prefetchQuery(channelsQuery),
    client.prefetchQuery(dmsQuery),
    client.prefetchQuery(membersQuery),
    cookies(),
  ]);

  return (
    <HydrateClient client={client}>
      <WorkspaceSidebar
        defaultLayout={parseLayout(cookieStore.get(LAYOUT_COOKIE)?.value)}
      >
        <WorkspaceSidebarPanel>
          <WorkspaceSidebarNav aria-label="Channels">
            <WorkspaceHeader />
            <WorkspaceNav />
            <ChannelGroups />
            <DmGroup />
          </WorkspaceSidebarNav>
        </WorkspaceSidebarPanel>
        <WorkspaceSidebarMain>{children}</WorkspaceSidebarMain>
      </WorkspaceSidebar>
    </HydrateClient>
  );
}
