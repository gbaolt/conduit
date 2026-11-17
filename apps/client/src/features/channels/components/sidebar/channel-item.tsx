import type { Room } from '@conduit/contract';
import { SidebarMenuAction } from '@conduit/ui/components/sidebar';
import { IconDots, IconHash, IconLock } from '@tabler/icons-react';

import { RoomDndItem } from '@/features/rooms/components/room-dnd';
import {
  RoomItem,
  RoomItemButton,
  RoomItemDraft,
  RoomItemLabel,
  RoomItemMuted,
} from '@/features/rooms/components/room-sidebar';

import {
  ChannelActionsContextMenu,
  ChannelActionsDropdown,
} from '../actions/channel-actions';

export function ChannelItem({ channel }: { channel: Room }) {
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  return (
    <RoomItem roomId={channel.id}>
      <ChannelActionsContextMenu
        channel={channel}
        render={
          <RoomDndItem
            item={{ kind: 'channel', id: channel.id, channel }}
            preview={
              <>
                <Glyph />
                <span className="truncate">{channel.name}</span>
              </>
            }
          />
        }
      >
        <RoomItemButton href={`/channels/${channel.id}`}>
          <Glyph />
          <RoomItemLabel>{channel.name}</RoomItemLabel>
          <RoomItemDraft />
          <RoomItemMuted />
        </RoomItemButton>
        <ChannelActionsDropdown
          channel={channel}
          trigger={
            <SidebarMenuAction
              showOnHover
              aria-label={`Actions for #${channel.name}`}
              className="hover:bg-pane/10 aria-expanded:bg-pane/10 text-primary-foreground! mr-0.5 rounded-sm"
            />
          }
        >
          <IconDots />
        </ChannelActionsDropdown>
      </ChannelActionsContextMenu>
    </RoomItem>
  );
}
