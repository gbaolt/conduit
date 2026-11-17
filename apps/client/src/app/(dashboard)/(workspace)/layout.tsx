import { cookies } from 'next/headers';
import { type ReactNode, Suspense } from 'react';

import { ChannelDialogsProvider } from '@/features/channels/context/channel-dialogs-provider';
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
  WorkspaceSidebarRooms,
} from '@/features/workspace/components/workspace-sidebar';
import { WorkspaceHeader } from '@/features/workspace/components/workspace-sidebar/workspace-header';
import { WorkspaceNav } from '@/features/workspace/components/workspace-sidebar/workspace-nav';
import {
  WorkspaceRooms,
  WorkspaceRoomsSkeleton,
} from '@/features/workspace/components/workspace-sidebar/workspace-rooms';
import {
  LAYOUT_COOKIE,
  parseLayout,
} from '@/features/workspace/lib/layout-cookie';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { channelsQuery } from '@/services/channels/queries';
import { dmsQuery } from '@/services/dms/queries';
import { membersQuery } from '@/services/workspaces/queries';

/**
 * Home and DMs share this shell, so switching between them keeps the sidebar mounted and the server
 * does not fetch the room lists again. Only the sidebar's list changes with the route.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <ChannelDialogsProvider>
      <DmDialogsProvider>
        <DmList>
          <Suspense
            fallback={
              <WorkspaceSidebar defaultLayout={undefined}>
                <WorkspaceSidebarPanel>
                  <WorkspaceSidebarRooms
                    channels={
                      <WorkspaceSidebarNav aria-label="Channels and direct messages">
                        <WorkspaceHeader />
                        <WorkspaceNav />
                        <WorkspaceRoomsSkeleton />
                      </WorkspaceSidebarNav>
                    }
                    dms={
                      <WorkspaceSidebarNav aria-label="Direct messages">
                        <DmListHeader />
                        <DmListSearch />
                        <DmListSkeleton />
                      </WorkspaceSidebarNav>
                    }
                  />
                </WorkspaceSidebarPanel>
                <WorkspaceSidebarMain>
                  <RoomPageSkeleton />
                </WorkspaceSidebarMain>
              </WorkspaceSidebar>
            }
          >
            <WorkspacePanel>{children}</WorkspacePanel>
          </Suspense>
        </DmList>
      </DmDialogsProvider>
    </ChannelDialogsProvider>
  );
}

async function WorkspacePanel({ children }: { children: ReactNode }) {
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
          <WorkspaceSidebarRooms
            channels={
              <WorkspaceSidebarNav aria-label="Channels and direct messages">
                <WorkspaceHeader />
                <WorkspaceNav />
                <WorkspaceRooms />
              </WorkspaceSidebarNav>
            }
            dms={
              <WorkspaceSidebarNav aria-label="Direct messages">
                <DmListHeader />
                <DmListSearch />
                <DmListItems />
              </WorkspaceSidebarNav>
            }
          />
        </WorkspaceSidebarPanel>
        <WorkspaceSidebarMain>
          <NewMessagePane>{children}</NewMessagePane>
        </WorkspaceSidebarMain>
      </WorkspaceSidebar>
    </HydrateClient>
  );
}
