'use client';

import type { Channel } from '@conduit/contract';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@conduit/ui/components/sidebar';
import { cn } from '@conduit/ui/lib/utils';
import { IconChevronDown, IconListSearch, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { channelsQuery } from '@/services/channels/queries';

import { useChannelDialogs } from '../context/channel-dialogs-provider';
import { ChannelLink } from './channel-link';

// The one place that decides which channels the sidebar shows and in what order.
function sidebarChannels(channels: Channel[]) {
  return channels
    .filter((channel) => channel.membership !== null)
    .sort(
      (a, b) =>
        Number(b.isDefault) - Number(a.isDefault) ||
        a.name.localeCompare(b.name)
    );
}

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

export function ChannelSidebar() {
  const { activeWorkspace } = useWorkspace();
  // An empty list stands in until WorkspaceProvider activates a workspace and the query refetches.
  const { data: channels = [] } = useQuery(channelsQuery);
  const { channelId } = useParams<{ channelId?: string }>();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <nav
      aria-label="Channels"
      className="text-sidebar-foreground flex h-full flex-col overflow-y-auto"
    >
      <div className="flex h-12 shrink-0 items-center px-4">
        <h2 className="truncate text-sm font-semibold">
          {activeWorkspace?.name}
        </h2>
      </div>
      <SidebarGroup>
        <SidebarGroupLabel
          render={
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setIsOpen((open) => !open)}
              className="hover:bg-sidebar-accent gap-1 text-left"
            />
          }
        >
          <IconChevronDown
            className={cn('transition-transform', !isOpen && '-rotate-90')}
          />
          Channels
        </SidebarGroupLabel>
        <AddChannelsMenu />
        {isOpen && (
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarChannels(channels).map((channel) => (
                <ChannelLink
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === channelId}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        )}
      </SidebarGroup>
    </nav>
  );
}
