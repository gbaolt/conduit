'use client';

import { canWorkspace } from '@conduit/contract';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  IconFolder,
  IconHash,
  IconLock,
  IconMessage,
  IconStar,
  IconUsersGroup,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  ChannelGroupAdd,
  ChannelGroupMenuItems,
  ChannelGroupSectionMenuItems,
} from '@/features/channels/components/sidebar/channel-group';
import { ChannelItem } from '@/features/channels/components/sidebar/channel-item';
import { DmGroupMenuItems } from '@/features/dms/components/sidebar/dm-group';
import { DmItem } from '@/features/dms/components/sidebar/dm-item';
import { RoomDnd } from '@/features/rooms/components/room-dnd';
import {
  RoomGroup,
  RoomGroupAdd,
  RoomGroupContent,
  RoomGroupEmpty,
  RoomGroupJump,
  type RoomGroupJumpItem,
  RoomGroupLabel,
  RoomGroupMenu,
} from '@/features/rooms/components/room-sidebar';
import {
  groupSidebar,
  sidebarDrop,
  type SidebarGroup as RoomsGroup,
  type SidebarItem,
} from '@/features/rooms/lib/sidebar-groups';
import { InviteDialog } from '@/features/workspace/components/workspace-settings/invite-dialog';
import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { sidebarStateQuery } from '@/services/activity/queries';
import { sessionQuery } from '@/services/auth/queries';
import { useMoveChannelToSection } from '@/services/channels/hooks';
import {
  channelSectionsQuery,
  channelsQuery,
} from '@/services/channels/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { dmsQuery } from '@/services/dms/queries';
import { useStarRoom, useUnstarRoom } from '@/services/rooms/hooks';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

/** The row that ends Direct messages: a conversation needs someone to talk to, so it invites them. */
function WorkspaceRoomsInvite() {
  const { activeWorkspace } = useWorkspace();
  const role = useWorkspaceRole();
  const [inviting, setInviting] = useState(false);

  if (!canWorkspace('invite', role)) return null;

  return (
    <>
      <RoomGroupAdd onClick={() => setInviting(true)}>
        Invite people
      </RoomGroupAdd>
      <InviteDialog
        workspaceName={activeWorkspace?.name ?? 'your workspace'}
        open={inviting}
        onOpenChange={setInviting}
      />
    </>
  );
}

const GROUP_ICONS = {
  starred: IconStar,
  section: IconFolder,
  channels: IconUsersGroup,
  dms: IconMessage,
} satisfies Record<RoomsGroup['kind'], typeof IconStar>;

function jumpItem(item: SidebarItem, viewerId: string): RoomGroupJumpItem {
  if (item.kind === 'dm') {
    return {
      roomId: item.id,
      link: <Link href={`/dm/${item.id}`} />,
      label: (
        <>
          <IconMessage />
          <span className="truncate">{dmTitle(item.dm, viewerId)}</span>
        </>
      ),
    };
  }

  const Glyph = item.channel.visibility === 'private' ? IconLock : IconHash;
  return {
    roomId: item.id,
    link: <Link href={`/channels/${item.id}`} />,
    label: (
      <>
        <Glyph />
        <span className="truncate">{item.channel.name}</span>
      </>
    ),
  };
}

/**
 * Home's rooms: Starred, the viewer's own sections, Channels, then Direct messages. A row drags onto another
 * group to star it, unstar it, or file a channel under a section.
 */
export function WorkspaceRooms() {
  // Empty lists stand in until WorkspaceProvider activates a workspace and the queries refetch.
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: sections = [] } = useQuery(channelSectionsQuery);
  const { data: entries = [] } = useQuery(sidebarStateQuery);
  const { data: session } = useQuery(sessionQuery);
  const { roomId: activeRoomId } = useParams<{ roomId?: string }>();
  const { mutate: star } = useStarRoom();
  const { mutate: unstar } = useUnstarRoom();
  const { mutate: move } = useMoveChannelToSection();
  const viewerId = session?.user.id ?? '';

  const groups = groupSidebar({
    channels,
    dms,
    sections,
    lastMessageAt: Object.fromEntries(
      entries.map((entry) => [entry.roomId, entry.lastMessageAt])
    ),
    activeRoomId,
  });
  const dropOn = (item: SidebarItem, groupId: string) => {
    const group = groups.find(({ id }) => id === groupId);
    return group ? sidebarDrop(item, group) : null;
  };

  return (
    <RoomDnd
      accepts={(item, groupId) => dropOn(item, groupId) !== null}
      onDrop={(item, groupId) => {
        const drop = dropOn(item, groupId);
        if (drop?.starred !== undefined) {
          (drop.starred ? star : unstar)({ roomId: item.id });
        }
        if (drop?.sectionId !== undefined) {
          move({ roomId: item.id, sectionId: drop.sectionId });
        }
      }}
    >
      {groups.map((group) => {
        const Icon = GROUP_ICONS[group.kind];
        const roomIds = group.items.map(({ id }) => id);

        return (
          <RoomGroup key={group.id} id={group.id}>
            <RoomGroupLabel icon={<Icon />}>{group.name}</RoomGroupLabel>
            <RoomGroupJump
              name={group.name}
              items={group.items.map((item) => jumpItem(item, viewerId))}
            />
            <RoomGroupMenu name={group.name} roomIds={roomIds}>
              {group.kind === 'channels' && <ChannelGroupMenuItems />}
              {group.section && (
                <ChannelGroupSectionMenuItems section={group.section} />
              )}
              {group.kind === 'dms' && <DmGroupMenuItems roomIds={roomIds} />}
            </RoomGroupMenu>
            <RoomGroupContent>
              {group.items.map((item) =>
                item.kind === 'channel' ? (
                  <ChannelItem key={item.id} channel={item.channel} />
                ) : (
                  <DmItem key={item.id} dm={item.dm} />
                )
              )}
              {group.kind === 'starred' && group.items.length === 0 && (
                <RoomGroupEmpty>Drag important stuff here</RoomGroupEmpty>
              )}
              {(group.kind === 'channels' || group.kind === 'section') && (
                <ChannelGroupAdd section={group.section} />
              )}
              {group.kind === 'dms' && <WorkspaceRoomsInvite />}
            </RoomGroupContent>
          </RoomGroup>
        );
      })}
    </RoomDnd>
  );
}

// Fixed widths: a random width would differ between the server and the client render.
const SKELETON_GROUPS = [
  { label: 'w-14', rows: ['w-36'] },
  { label: 'w-16', rows: ['w-24', 'w-28', 'w-20', 'w-24'] },
  { label: 'w-28', rows: ['w-28', 'w-20', 'w-24'] },
];

/** Stands in for `WorkspaceRooms`: Starred, Channels and Direct messages, each a label row over 32px rows. */
export function WorkspaceRoomsSkeleton() {
  return SKELETON_GROUPS.map(({ label, rows }) => (
    <SidebarGroup key={label} aria-hidden>
      <div className="mb-1 flex h-8 items-center gap-1.5 px-2">
        <Skeleton className="size-4" />
        <Skeleton className={`h-3 ${label}`} />
      </div>
      <SidebarMenu>
        {rows.map((width, index) => (
          <SidebarMenuItem
            key={index}
            className="flex h-8 items-center gap-2 pr-2 pl-6"
          >
            <Skeleton className="size-4" />
            <Skeleton className={`h-4 ${width}`} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ));
}
