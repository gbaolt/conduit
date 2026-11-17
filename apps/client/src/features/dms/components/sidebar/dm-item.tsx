'use client';

import type { Dm } from '@conduit/contract';
import { SidebarMenuAction } from '@conduit/ui/components/sidebar';
import { IconDots } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { PresenceDot } from '@/components/presence-dot';
import { UserAvatar } from '@/components/user-avatar';
import { RoomDndItem } from '@/features/rooms/components/room-dnd';
import {
  RoomItem,
  RoomItemButton,
  RoomItemDraft,
  RoomItemLabel,
  RoomItemMuted,
} from '@/features/rooms/components/room-sidebar';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';

import { DmActionsContextMenu, DmActionsDropdown } from '../actions/dm-actions';

/**
 * One person's picture with their presence, how many people a group holds, or your own picture. It is 18px
 * wide but takes a glyph's 16px, so a DM's name lines up with a channel's.
 */
export function DmItemAvatar({ dm, viewerId }: { dm: Dm; viewerId: string }) {
  const others = dm.members.filter((member) => member.userId !== viewerId);
  const person = others[0] ?? dm.members[0];

  if (others.length > 1 || !person) {
    return (
      <span
        aria-hidden
        className="bg-muted text-muted-foreground -mx-px flex size-4.5 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium tabular-nums"
      >
        {others.length}
      </span>
    );
  }

  return (
    <span className="relative -mx-px size-4.5 shrink-0">
      {/* The row's name follows, so the picture adds nothing to read out. */}
      <span aria-hidden className="contents">
        <UserAvatar
          name={person.name}
          image={person.image}
          className="size-4.5 rounded-sm text-[10px]"
        />
      </span>
      <PresenceDot
        userId={person.userId}
        className="ring-pane absolute -right-0.5 -bottom-0.5"
      />
    </span>
  );
}

/** A DM as one line of the Home sidebar: who it is with. The DMs page shows the preview and the time. */
export function DmItem({ dm }: { dm: Dm }) {
  const { data: session } = useQuery(sessionQuery);
  const viewerId = session?.user.id ?? '';
  const title = dmTitle(dm, viewerId);
  const avatar = <DmItemAvatar dm={dm} viewerId={viewerId} />;

  return (
    <RoomItem roomId={dm.id}>
      <DmActionsContextMenu
        dm={dm}
        render={
          <RoomDndItem
            item={{ kind: 'dm', id: dm.id, dm }}
            preview={
              <>
                {avatar}
                <span className="truncate">{title}</span>
              </>
            }
          />
        }
      >
        <RoomItemButton href={`/dm/${dm.id}`}>
          {avatar}
          <RoomItemLabel>{title}</RoomItemLabel>
          <RoomItemDraft />
          <RoomItemMuted />
        </RoomItemButton>
        <DmActionsDropdown
          dm={dm}
          trigger={
            <SidebarMenuAction
              showOnHover
              aria-label={`Actions for ${title}`}
              className="hover:bg-pane/10 aria-expanded:bg-pane/10 text-primary-foreground! mr-0.5 rounded-sm"
            />
          }
        >
          <IconDots />
        </DmActionsDropdown>
      </DmActionsContextMenu>
    </RoomItem>
  );
}
