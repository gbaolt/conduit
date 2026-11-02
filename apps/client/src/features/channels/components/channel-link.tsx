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
          />
        }
      >
        <IconDots />
      </ChannelActionsDropdown>
    </ChannelContextMenu>
  );
}
