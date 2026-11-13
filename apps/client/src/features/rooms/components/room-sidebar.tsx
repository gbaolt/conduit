'use client';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from '@conduit/ui/components/sidebar';
import { cn } from '@conduit/ui/lib/utils';
import { IconBellOff, IconChevronDown, IconPencil } from '@tabler/icons-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createContext, type ReactNode, use } from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import {
  useHasDraft,
  useIsMuted,
  useIsUnread,
} from '@/services/activity/hooks';

import { useCollapsedGroups } from '../lib/use-collapsed-groups';

const RoomGroupContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
  activeRoomId: string | undefined;
}>({ collapsed: false, toggle: () => {}, activeRoomId: undefined });

/** A collapsible sidebar group of rooms. Collapsing it is remembered per workspace under `id`. */
export function RoomGroup({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { activeWorkspace } = useWorkspace();
  const { isCollapsed, toggle } = useCollapsedGroups(activeWorkspace?.id);
  const { roomId } = useParams<{ roomId?: string }>();

  return (
    <RoomGroupContext
      value={{
        collapsed: isCollapsed(id),
        toggle: () => toggle(id),
        activeRoomId: roomId,
      }}
    >
      <SidebarGroup>{children}</SidebarGroup>
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
  const { collapsed, toggle } = use(RoomGroupContext);

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
      <span className="truncate text-sm">{children}</span>
    </SidebarGroupLabel>
  );
}

export function RoomGroupContent({ children }: { children: ReactNode }) {
  return (
    <SidebarGroupContent>
      <SidebarMenu>{children}</SidebarMenu>
    </SidebarGroupContent>
  );
}

const RoomItemContext = createContext<{
  isActive: boolean;
  unread: boolean;
  muted: boolean;
  hasDraft: boolean;
}>({ isActive: false, unread: false, muted: false, hasDraft: false });

/**
 * One room's row: wrap a `SidebarMenuItem` in it. A collapsed group still shows the open room,
 * so the viewer keeps their place.
 */
export function RoomItem({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const { collapsed, activeRoomId } = use(RoomGroupContext);
  const isActive = roomId === activeRoomId;
  // The open room is being read, so it never reads as unread.
  const unread = useIsUnread(roomId) && !isActive;
  const muted = useIsMuted(roomId);
  const hasDraft = useHasDraft(roomId) && !isActive;

  if (collapsed && !isActive) return null;

  return (
    <RoomItemContext value={{ isActive, unread, muted, hasDraft }}>
      {children}
    </RoomItemContext>
  );
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
