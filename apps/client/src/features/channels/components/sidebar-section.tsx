'use client';

import type { ChannelSection } from '@conduit/contract';
import {
  DropdownMenu,
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
} from '@conduit/ui/components/sidebar';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconDots,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { useDeleteChannelSection } from '@/services/channels/hooks';

import { useChannelDialogs } from '../context/channel-dialogs-provider';
import type { SidebarGroup as SidebarGroupData } from '../lib/group-sidebar';
import { ChannelLink } from './channel-link';

/** A collapsible group of channel rows. `action` is the button at the header's right edge. */
export function SidebarSection({
  group,
  activeChannelId,
  isCollapsed,
  onToggle,
  action,
}: {
  group: SidebarGroupData;
  activeChannelId: string | undefined;
  isCollapsed: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) {
  // A collapsed group still shows the open channel, so the viewer keeps their place.
  const channels = isCollapsed
    ? group.channels.filter((channel) => channel.id === activeChannelId)
    : group.channels;

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        render={
          <button
            type="button"
            aria-expanded={!isCollapsed}
            onClick={onToggle}
            className="hover:bg-sidebar-accent mb-1 gap-1 text-left"
          />
        }
      >
        <IconChevronDown
          className={cn('transition-transform', isCollapsed && '-rotate-90')}
        />
        <span className="truncate">{group.name}</span>
      </SidebarGroupLabel>
      {action}
      {channels.length > 0 && (
        <SidebarGroupContent>
          <SidebarMenu>
            {channels.map((channel) => (
              <ChannelLink
                key={channel.id}
                channel={channel}
                isActive={channel.id === activeChannelId}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

/** Rename, delete, and reorder one of the viewer's own sections. */
export function SectionMenu({
  section,
  onMove,
}: {
  section: ChannelSection;
  /** `null` where the section cannot move that way. */
  onMove: { up: (() => void) | null; down: (() => void) | null };
}) {
  const { open } = useChannelDialogs();
  const { mutateAsync: deleteSection } = useDeleteChannelSection();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarGroupAction aria-label={`Actions for ${section.name}`} />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => open({ kind: 'section-name', section })}
        >
          <IconPencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!onMove.up}
          onClick={onMove.up ?? undefined}
        >
          <IconArrowUp />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!onMove.down}
          onClick={onMove.down ?? undefined}
        >
          <IconArrowDown />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* mutateAsync, not mutate: the menu closes on click, and per-call callbacks die with it. */}
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            deleteSection({ sectionId: section.id }).catch((error: Error) =>
              toast.error(error.message)
            )
          }
        >
          <IconTrash />
          Delete section
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
