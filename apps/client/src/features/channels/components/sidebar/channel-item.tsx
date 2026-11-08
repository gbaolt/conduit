import type { Room } from '@conduit/contract';
import {
  SidebarMenuAction,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { IconDots, IconHash, IconLock } from '@tabler/icons-react';

import {
  RoomItem,
  RoomItemButton,
  RoomItemDraft,
  RoomItemLabel,
} from '@/features/rooms/components/room-sidebar';

import {
  ChannelActionsContextMenu,
  ChannelActionsDropdown,
} from '../actions/channel-actions';

export function ChannelItem({ channel }: { channel: Room }) {
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  return (
    <RoomItem roomId={channel.id}>
      <ChannelActionsContextMenu channel={channel} render={<SidebarMenuItem />}>
        <RoomItemButton href={`/channels/${channel.id}`}>
          <Glyph />
          <RoomItemLabel>{channel.name}</RoomItemLabel>
          <RoomItemDraft />
        </RoomItemButton>
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
      </ChannelActionsContextMenu>
    </RoomItem>
  );
}
