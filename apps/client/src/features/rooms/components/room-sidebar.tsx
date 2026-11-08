'use client';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from '@conduit/ui/components/sidebar';
import { cn } from '@conduit/ui/lib/utils';
import { IconChevronDown, IconPencil } from '@tabler/icons-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createContext, type ReactNode, use } from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { useHasDraft, useIsUnread } from '@/services/activity/hooks';

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

/** The group's header: a button that collapses and expands it. */
export function RoomGroupLabel({ children }: { children: ReactNode }) {
  const { collapsed, toggle } = use(RoomGroupContext);

  return (
    <SidebarGroupLabel
      render={
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={toggle}
          className="hover:bg-sidebar-accent mb-1 gap-1 text-left"
        />
      }
    >
      <IconChevronDown
        className={cn('transition-transform', collapsed && '-rotate-90')}
      />
      <span className="truncate">{children}</span>
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
  hasDraft: boolean;
}>({ isActive: false, unread: false, hasDraft: false });

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
  const hasDraft = useHasDraft(roomId) && !isActive;

  if (collapsed && !isActive) return null;

  return (
    <RoomItemContext value={{ isActive, unread, hasDraft }}>
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
      className="data-active:text-primary-foreground! data-active:bg-primary!"
      render={<Link href={href} aria-current={isActive ? 'page' : undefined} />}
    >
      {children}
    </SidebarMenuButton>
  );
}

/** The room's name, bold while it has unread messages. */
export function RoomItemLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { unread } = use(RoomItemContext);

  return (
    <>
      <span
        className={cn(unread && 'text-foreground font-semibold', className)}
      >
        {children}
      </span>
      {unread && <span className="sr-only">, unread</span>}
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
