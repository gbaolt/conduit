'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { SidebarGroupAction } from '@conduit/ui/components/sidebar';
import { IconListSearch, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { useReorderChannelSections } from '@/services/channels/hooks';
import {
  channelSectionsQuery,
  channelsQuery,
} from '@/services/channels/queries';

import { useChannelDialogs } from '../context/channel-dialogs-provider';
import { CHANNELS_GROUP_ID, groupSidebar } from '../lib/group-sidebar';
import { useCollapsedGroups } from '../lib/use-collapsed-groups';
import { SectionMenu, SidebarSection } from './sidebar-section';

function AddChannelsMenu() {
  const { open } = useChannelDialogs();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarGroupAction aria-label="Add channels" />}
      >
        <IconPlus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => open({ kind: 'create' })}>
          <IconPlus />
          Create a new channel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open({ kind: 'browse' })}>
          <IconListSearch />
          Browse channels
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChannelList() {
  const { activeWorkspace } = useWorkspace();
  // Empty lists stand in until WorkspaceProvider activates a workspace and the queries refetch.
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: sections = [] } = useQuery(channelSectionsQuery);
  const { channelId } = useParams<{ channelId?: string }>();
  const { isCollapsed, toggle } = useCollapsedGroups(activeWorkspace?.id);
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
    <SidebarSection
      key={group.id}
      group={group}
      activeChannelId={channelId}
      isCollapsed={isCollapsed(group.id)}
      onToggle={() => toggle(group.id)}
      action={
        group.section ? (
          <SectionMenu
            section={group.section}
            onMove={{
              up: moveBy(group.section.id, -1),
              down: moveBy(group.section.id, 1),
            }}
          />
        ) : group.id === CHANNELS_GROUP_ID ? (
          <AddChannelsMenu />
        ) : null
      }
    />
  ));
}
