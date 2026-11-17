'use client';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconBellOff,
  IconChecks,
  IconChevronDown,
  IconDots,
  IconList,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Children,
  type ComponentProps,
  createContext,
  type ReactElement,
  type ReactNode,
  use,
  useId,
} from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import {
  useHasDraft,
  useIsMuted,
  useIsUnread,
} from '@/services/activity/hooks';
import { isUnread, sidebarStateQuery } from '@/services/activity/queries';
import { useMarkRoomsRead } from '@/services/rooms/hooks';

import { useStoredGroups } from '../hooks/use-stored-groups';
import { useRoomDndDrop } from './room-dnd';

const RoomGroupContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
  unreadsOnly: boolean;
  toggleUnreadsOnly: () => void;
  activeRoomId: string | undefined;
  /** The id of the element that names the group. */
  labelId: string | undefined;
}>({
  collapsed: false,
  toggle: () => {},
  unreadsOnly: false,
  toggleUnreadsOnly: () => {},
  activeRoomId: undefined,
  labelId: undefined,
});

/**
 * A collapsible sidebar group of rooms. Collapsing it, and showing only its unread rooms, are remembered per
 * workspace under `id`. Inside `RoomDnd` it is also where a dragged row lands.
 */
export function RoomGroup({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { activeWorkspace } = useWorkspace();
  const collapsed = useStoredGroups(
    'collapsed-sidebar-groups',
    activeWorkspace?.id
  );
  const unreadsOnly = useStoredGroups(
    'unreads-only-sidebar-groups',
    activeWorkspace?.id
  );
  const { roomId } = useParams<{ roomId?: string }>();
  const drop = useRoomDndDrop(id);
  const labelId = useId();

  return (
    <RoomGroupContext
      value={{
        collapsed: collapsed.has(id),
        toggle: () => collapsed.toggle(id),
        unreadsOnly: unreadsOnly.has(id),
        toggleUnreadsOnly: () => unreadsOnly.toggle(id),
        activeRoomId: roomId,
        labelId,
      }}
    >
      <SidebarGroup
        ref={drop.ref}
        role="group"
        aria-labelledby={labelId}
        data-drop-over={drop.over || undefined}
        className="data-drop-over:bg-sidebar-accent/60 data-drop-over:ring-sidebar-ring/60 rounded-md transition-[background-color,box-shadow] duration-150 ease-out ring-inset data-drop-over:ring-1"
      >
        {children}
      </SidebarGroup>
    </RoomGroupContext>
  );
}

/** The group's header: a button that collapses and expands it. Its `icon` turns into a chevron on hover or focus. */
export function RoomGroupLabel({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  const { collapsed, toggle, unreadsOnly, labelId } = use(RoomGroupContext);

  return (
    <SidebarGroupLabel
      render={
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={toggle}
          className="hover:bg-sidebar-accent group/room-group-label mb-1 gap-1.5 text-left"
        />
      }
    >
      <span className="grid shrink-0 *:col-start-1 *:row-start-1 [&_svg]:size-4">
        <span className="flex transition-opacity group-hover/room-group-label:opacity-0 group-focus-visible/room-group-label:opacity-0">
          {icon}
        </span>
        <IconChevronDown
          className={cn(
            'opacity-0 transition-[opacity,transform,rotate] group-hover/room-group-label:opacity-100 group-focus-visible/room-group-label:opacity-100',
            collapsed && '-rotate-90'
          )}
        />
      </span>
      <span id={labelId} className="truncate text-sm">
        {children}
      </span>
      {unreadsOnly && (
        <span className="shrink-0 font-normal opacity-70">· Unreads</span>
      )}
    </SidebarGroupLabel>
  );
}

function RoomGroupMenuItems({
  roomIds,
  children,
}: {
  roomIds: string[];
  children: ReactNode;
}) {
  const { unreadsOnly, toggleUnreadsOnly } = use(RoomGroupContext);
  const { mutate: markRead } = useMarkRoomsRead();
  const { data: unreadIds = [] } = useQuery({
    ...sidebarStateQuery,
    select: (rows) =>
      rows
        .filter((row) => roomIds.includes(row.roomId) && isUnread(row))
        .map((row) => row.roomId),
  });

  return (
    <>
      {children}
      {Children.toArray(children).length > 0 && <DropdownMenuSeparator />}
      <DropdownMenuItem
        disabled={unreadIds.length === 0}
        onClick={() => markRead({ roomIds: unreadIds })}
      >
        <IconChecks />
        Mark all as read
      </DropdownMenuItem>
      <DropdownMenuCheckboxItem
        checked={unreadsOnly}
        onCheckedChange={toggleUnreadsOnly}
      >
        Unreads only
      </DropdownMenuCheckboxItem>
    </>
  );
}

/**
 * The group's "More actions" menu. `children` are the rows only this group has. Every group ends with
 * "Mark all as read" and "Unreads only", which act on `roomIds`.
 */
export function RoomGroupMenu({
  name,
  roomIds,
  children,
}: {
  name: string;
  roomIds: string[];
  children?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarGroupAction aria-label={`More actions for ${name}`} />}
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <RoomGroupMenuItems roomIds={roomIds}>{children}</RoomGroupMenuItems>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type RoomGroupJumpItem = {
  roomId: string;
  /** The link the row becomes: `<Link href="…" />`. An element, so the route's type is checked where it is written. */
  link: ReactElement;
  /** The row's glyph and name, as the sidebar row shows them. */
  label: ReactNode;
};

function RoomGroupJumpItems({ items }: { items: RoomGroupJumpItem[] }) {
  const { toggle } = use(RoomGroupContext);
  const { data: entries = [] } = useQuery(sidebarStateQuery);
  const unreadIds = new Set(
    entries.filter((entry) => isUnread(entry)).map((entry) => entry.roomId)
  );
  const unreadFirst = [
    ...items.filter((item) => unreadIds.has(item.roomId)),
    ...items.filter((item) => !unreadIds.has(item.roomId)),
  ];

  return (
    <>
      <div className="max-h-72 overflow-y-auto">
        {unreadFirst.map(({ roomId, link, label }) => (
          <DropdownMenuItem
            key={roomId}
            render={link}
            className={cn(unreadIds.has(roomId) && 'font-semibold')}
          >
            {label}
            {unreadIds.has(roomId) && <span className="sr-only">, unread</span>}
          </DropdownMenuItem>
        ))}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={toggle}>
        <IconChevronDown />
        Expand section
      </DropdownMenuItem>
    </>
  );
}

/**
 * "More conversations": a collapsed group's rooms as a menu, unread ones first, so one opens without
 * expanding the group. It renders nothing while the group is expanded or has no rooms.
 */
export function RoomGroupJump({
  name,
  items,
}: {
  name: string;
  items: RoomGroupJumpItem[];
}) {
  const { collapsed } = use(RoomGroupContext);
  if (!collapsed || items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarGroupAction
            aria-label={`More conversations in ${name}`}
            // Left of the "More actions" button.
            className="right-9"
          />
        }
      >
        <IconList />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <RoomGroupJumpItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RoomGroupContent({ children }: { children: ReactNode }) {
  return (
    <SidebarGroupContent>
      <SidebarMenu>{children}</SidebarMenu>
    </SidebarGroupContent>
  );
}

/** One line that stands in for the rows of a group that has none. Hidden while the group is collapsed. */
export function RoomGroupEmpty({ children }: { children: ReactNode }) {
  const { collapsed } = use(RoomGroupContext);
  if (collapsed) return null;

  return (
    <SidebarMenuItem className="text-muted-foreground flex h-8 items-center truncate pr-2 pl-6 text-xs">
      {children}
    </SidebarMenuItem>
  );
}

/**
 * The group's last row, which adds a room to it: "Add channels". It is a button, or a menu's trigger through
 * `render`. Hidden while the group is collapsed.
 */
export function RoomGroupAdd({
  children,
  className,
  ...props
}: ComponentProps<typeof SidebarMenuButton>) {
  const { collapsed } = use(RoomGroupContext);
  if (collapsed) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={cn('text-muted-foreground pl-6', className)}
        {...props}
      >
        <IconPlus />
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

const RoomItemContext = createContext<{
  isActive: boolean;
  unread: boolean;
  muted: boolean;
  hasDraft: boolean;
}>({ isActive: false, unread: false, muted: false, hasDraft: false });

/**
 * One room's row: wrap a `SidebarMenuItem` in it. A collapsed group, and a group set to unreads only, still
 * show the open room, so the viewer keeps their place.
 */
export function RoomItem({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const { collapsed, unreadsOnly, activeRoomId } = use(RoomGroupContext);
  const isActive = roomId === activeRoomId;
  const hasUnread = useIsUnread(roomId);
  const muted = useIsMuted(roomId);
  const hasDraft = useHasDraft(roomId) && !isActive;

  if ((collapsed || (unreadsOnly && !hasUnread)) && !isActive) return null;

  return (
    // The open room is being read, so it never reads as unread.
    <RoomItemContext
      value={{ isActive, unread: hasUnread && !isActive, muted, hasDraft }}
    >
      {children}
    </RoomItemContext>
  );
}

/** The row's state, for a caller that lays out its own button. */
export function useRoomItem() {
  return use(RoomItemContext);
}

export function RoomItemButton<T extends string>({
  href,
  children,
}: {
  href: Route<T>;
  children: ReactNode;
}) {
  const { isActive } = use(RoomItemContext);

  return (
    <SidebarMenuButton
      isActive={isActive}
      className="data-active:text-primary-foreground! data-active:bg-primary! pl-6"
      render={<Link href={href} aria-current={isActive ? 'page' : undefined} />}
    >
      {children}
    </SidebarMenuButton>
  );
}

/** The room's name, bold while it has unread messages. A muted room is dimmed and never bold. */
export function RoomItemLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { unread, muted } = use(RoomItemContext);
  const bold = unread && !muted;

  return (
    <>
      <span
        className={cn(
          bold && 'text-foreground font-semibold',
          muted && 'opacity-55',
          className
        )}
      >
        {children}
      </span>
      {bold && <span className="sr-only">, unread</span>}
    </>
  );
}

/** A muted bell at the row's end while the viewer has the room muted. */
export function RoomItemMuted() {
  const { muted, hasDraft } = use(RoomItemContext);
  if (!muted) return null;

  return (
    <>
      <IconBellOff
        aria-hidden
        className={cn(
          'text-muted-foreground size-3.5 opacity-55',
          // The draft pencil before it already took the free space.
          hasDraft ? 'ml-1' : 'ml-auto'
        )}
      />
      <span className="sr-only">, muted</span>
    </>
  );
}

/** A pencil at the row's end while the viewer has an unsent draft there. */
export function RoomItemDraft() {
  const { hasDraft } = use(RoomItemContext);
  if (!hasDraft) return null;

  return (
    <>
      <IconPencil
        aria-hidden
        className="text-muted-foreground ml-auto size-3.5"
      />
      <span className="sr-only">, draft</span>
    </>
  );
}
