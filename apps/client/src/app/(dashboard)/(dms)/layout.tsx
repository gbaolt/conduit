import { cookies } from 'next/headers';
import { type ReactNode, Suspense } from 'react';

import {
  DmList,
  DmListHeader,
  DmListItems,
  DmListSearch,
  DmListSkeleton,
} from '@/features/dms/components/dm-list/dm-list';
import { DmDialogsProvider } from '@/features/dms/context/dm-dialogs-provider';
import { NewMessagePane } from '@/features/messages/components/new-message/new-message';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import {
  WorkspaceSidebar,
  WorkspaceSidebarMain,
  WorkspaceSidebarNav,
  WorkspaceSidebarPanel,
} from '@/features/workspace/components/workspace-sidebar';
import {
  LAYOUT_COOKIE,
  parseLayout,
} from '@/features/workspace/lib/layout-cookie';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelsQuery } from '@/services/channels/queries';
import { dmsQuery } from '@/services/dms/queries';
import { membersQuery } from '@/services/workspaces/queries';

/** The DMs page: the viewer's DMs beside the open one, in the same shell as Home. */
export default function DmsLayout({ children }: { children: ReactNode }) {
  return (
    <DmDialogsProvider>
      <DmList>
        <Suspense
          fallback={
            <WorkspaceSidebar defaultLayout={undefined}>
              <WorkspaceSidebarPanel>
                <WorkspaceSidebarNav aria-label="Direct messages">
                  <DmListHeader />
                  <DmListSearch />
                  <DmListSkeleton />
                </WorkspaceSidebarNav>
              </WorkspaceSidebarPanel>
              <WorkspaceSidebarMain>
                <RoomPageSkeleton />
              </WorkspaceSidebarMain>
            </WorkspaceSidebar>
          }
        >
          <DmsPanel>{children}</DmsPanel>
        </Suspense>
      </DmList>
    </DmDialogsProvider>
  );
}

async function DmsPanel({ children }: { children: ReactNode }) {
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
          <WorkspaceSidebarNav aria-label="Direct messages">
            <DmListHeader />
            <DmListSearch />
            <DmListItems />
          </WorkspaceSidebarNav>
        </WorkspaceSidebarPanel>
        <WorkspaceSidebarMain>
          <NewMessagePane>{children}</NewMessagePane>
        </WorkspaceSidebarMain>
      </WorkspaceSidebar>
    </HydrateClient>
  );
}
