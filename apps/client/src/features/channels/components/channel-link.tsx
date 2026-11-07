import type { Channel } from '@conduit/contract';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { IconDots, IconHash, IconLock } from '@tabler/icons-react';
import Link from 'next/link';

import {
  ChannelActionsDropdown,
  ChannelContextMenu,
} from './channel-actions-menu';

export function ChannelLink({
  channel,
  isActive,
}: {
  channel: Channel;
  isActive: boolean;
}) {
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  return (
    <ChannelContextMenu channel={channel} render={<SidebarMenuItem />}>
      <SidebarMenuButton
        isActive={isActive}
        className="data-active:text-primary-foreground! data-active:bg-primary!"
        render={
          <Link
            href={`/channels/${channel.id}`}
            aria-current={isActive ? 'page' : undefined}
          />
        }
      >
        <Glyph />
        <span>{channel.name}</span>
      </SidebarMenuButton>
      <ChannelActionsDropdown
        channel={channel}
        trigger={
          <SidebarMenuAction
            showOnHover
            aria-label={`Actions for #${channel.name}`}
            className="hover:bg-surface/10 aria-expanded:bg-surface/10 text-primary-foreground! mr-0.5 rounded-sm"
          />
        }
      >
        <IconDots />
      </ChannelActionsDropdown>
    </ChannelContextMenu>
  );
}
