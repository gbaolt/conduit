'use client';

import { type Dm, plainText, type SidebarEntry } from '@conduit/contract';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { IconDots, IconUsers } from '@tabler/icons-react';
import Link from 'next/link';

import { PresenceDot } from '@/components/presence-dot';
import { UserAvatar } from '@/components/user-avatar';
import {
  RoomItem,
  RoomItemDraft,
  RoomItemLabel,
  RoomItemMuted,
  useRoomItem,
} from '@/features/rooms/components/room-sidebar';
import { dmTitle } from '@/services/dms/dm-title';

import { dmTime } from '../../lib/dm-time';
import { DmActionsContextMenu, DmActionsDropdown } from '../actions/dm-actions';

const fullTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
});

/** One person's picture with their presence, two overlapping pictures for a group, or your own. */
function DmListItemAvatar({ dm, viewerId }: { dm: Dm; viewerId: string }) {
  const others = dm.members.filter((member) => member.userId !== viewerId);
  const [first, second] = others.length === 0 ? dm.members : others;

  if (!first) {
    return (
      <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
        <IconUsers aria-hidden />
      </span>
    );
  }

  if (others.length > 1 && second) {
    return (
      <span aria-hidden className="relative size-9 shrink-0">
        <UserAvatar
          name={first.name}
          image={first.image}
          className="absolute top-0 left-0 size-6 rounded-md text-[10px]"
        />
        <UserAvatar
          name={second.name}
          image={second.image}
          className="ring-pane absolute right-0 bottom-0 size-6 rounded-md text-[10px] ring-2"
        />
      </span>
    );
  }

  return (
    <span className="relative size-9 shrink-0">
      <UserAvatar
        name={first.name}
        image={first.image}
        className="size-9 rounded-md"
      />
      <PresenceDot
        userId={first.userId}
        className="ring-pane absolute -right-0.5 -bottom-0.5"
      />
    </span>
  );
}

/** The latest message as one line of text, led by "You:" or, in a group, the sender's first name. */
function previewOf(
  dm: Dm,
  entry: SidebarEntry | undefined,
  viewerId: string,
  names: Record<string, string>
) {
  if (!entry?.lastBody || !entry.lastAuthorId) return null;
  const text = plainText(entry.lastBody, names);
  if (entry.lastAuthorId === viewerId) return `You: ${text}`;
  if (dm.members.length > 2) {
    const sender = names[entry.lastAuthorId]?.split(' ')[0];
    return sender ? `${sender}: ${text}` : text;
  }
  return text;
}

/** The row's link. It grows to hold the preview line, and fills with the primary color while open. */
function DmListItemButton({
  href,
  children,
}: {
  href: `/dms/${string}`;
  children: React.ReactNode;
}) {
  const { isActive } = useRoomItem();

  return (
    <SidebarMenuButton
      size="auto"
      isActive={isActive}
      // The actions button sits over the time, so the row keeps its own padding.
      className="data-active:text-primary-foreground! data-active:bg-primary! gap-2.5 py-2 pr-2!"
      render={<Link href={href} aria-current={isActive ? 'page' : undefined} />}
    >
      {children}
    </SidebarMenuButton>
  );
}

/** A DM in the list: who it is with, when it last moved, and the latest message. Its actions open on right-click, or from the button that takes the time's place on hover. */
export function DmListItem({
  dm,
  entry,
  at,
  now,
  viewerId,
  names,
}: {
  dm: Dm;
  entry: SidebarEntry | undefined;
  /** When the DM last had a message, or when it was opened. */
  at: Date;
  now: Date;
  viewerId: string;
  names: Record<string, string>;
}) {
  const preview = previewOf(dm, entry, viewerId, names);
  const title = dmTitle(dm, viewerId);

  return (
    <RoomItem roomId={dm.id}>
      <DmActionsContextMenu dm={dm} render={<SidebarMenuItem />}>
        <DmListItemButton href={`/dms/${dm.id}`}>
          <DmListItemAvatar dm={dm} viewerId={viewerId} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <RoomItemLabel className="min-w-0 flex-1 truncate">
                {title}
              </RoomItemLabel>
              <time
                dateTime={at.toISOString()}
                title={fullTime.format(at)}
                suppressHydrationWarning
                className="shrink-0 text-xs tabular-nums opacity-70 pointer-fine:group-focus-within/menu-item:opacity-0 pointer-fine:group-hover/menu-item:opacity-0 pointer-fine:group-has-aria-expanded/menu-item:opacity-0"
              >
                {dmTime(at, now)}
              </time>
            </span>
            <span className="flex min-w-0 items-start gap-1">
              <span className="line-clamp-1 min-w-0 flex-1 text-xs/none opacity-70">
                {preview}
              </span>
              <RoomItemDraft />
              <RoomItemMuted />
            </span>
          </span>
        </DmListItemButton>
        <DmActionsDropdown
          dm={dm}
          trigger={
            <SidebarMenuAction
              aria-label={`Actions for ${title}`}
              className="hover:bg-pane/10 aria-expanded:bg-pane/10 text-primary-foreground! top-2! right-2 rounded-sm opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 aria-expanded:opacity-100 pointer-coarse:hidden"
            />
          }
        >
          <IconDots />
        </DmActionsDropdown>
      </DmActionsContextMenu>
    </RoomItem>
  );
}
