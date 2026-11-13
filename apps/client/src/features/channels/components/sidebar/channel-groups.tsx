'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { SidebarGroupAction } from '@conduit/ui/components/sidebar';
import {
  IconFolder,
  IconHash,
  IconListSearch,
  IconPlus,
  IconStar,
  IconUsersGroup,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import {
  RoomGroup,
  RoomGroupContent,
  RoomGroupLabel,
} from '@/features/rooms/components/room-sidebar';
import { useReorderChannelSections } from '@/services/channels/hooks';
import {
  channelSectionsQuery,
  channelsQuery,
} from '@/services/channels/queries';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import {
  CHANNELS_GROUP_ID,
  groupSidebar,
  STARRED_GROUP_ID,
} from '../../lib/group-sidebar';
import { useCanCreateChannel } from '../../lib/use-can-create-channel';
import { ChannelItem } from './channel-item';
import { SidebarSectionMenu } from './sidebar-section-menu';

function AddChannelsMenu() {
  const { open } = useChannelDialogs();
  const canCreate = useCanCreateChannel('private');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarGroupAction aria-label="Add channels" />}
      >
        <IconPlus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canCreate ? (
          <DropdownMenuItem onClick={() => open({ kind: 'create' })}>
            <IconPlus />
            Create a new channel
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => open({ kind: 'browse' })}>
          <IconListSearch />
          Browse channels
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Starred, the viewer's own sections, then Channels. */
export function ChannelGroups() {
  // Empty lists stand in until WorkspaceProvider activates a workspace and the queries refetch.
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: sections = [] } = useQuery(channelSectionsQuery);
  const { mutate: reorder } = useReorderChannelSections();

  const groups = groupSidebar(channels, sections);
  const sectionIds = groups.flatMap(({ section }) =>
    section ? [section.id] : []
  );

  // Swaps the section with its neighbour; null where there is none to swap with.
  const moveBy = (sectionId: string, step: -1 | 1) => {
    const from = sectionIds.indexOf(sectionId);
    const to = from + step;
    if (to < 0 || to >= sectionIds.length) return null;
    return () => {
      const next = [...sectionIds];
      [next[from], next[to]] = [next[to]!, next[from]!];
      reorder({ sectionIds: next });
    };
  };

  return groups.map((group) => (
    <RoomGroup key={group.id} id={group.id}>
      <RoomGroupLabel icon={groupIcon(group.id)}>{group.name}</RoomGroupLabel>
      {group.section && (
        <SidebarSectionMenu
          section={group.section}
          onMove={{
            up: moveBy(group.section.id, -1),
            down: moveBy(group.section.id, 1),
          }}
        />
      )}
      {group.id === CHANNELS_GROUP_ID && <AddChannelsMenu />}
      <RoomGroupContent>
        {group.channels.map((channel) => (
          <ChannelItem key={channel.id} channel={channel} />
        ))}
      </RoomGroupContent>
    </RoomGroup>
  ));
}

function groupIcon(groupId: string) {
  if (groupId === STARRED_GROUP_ID) return <IconStar />;
  if (groupId === CHANNELS_GROUP_ID) return <IconUsersGroup />;
  return <IconFolder />;
}
