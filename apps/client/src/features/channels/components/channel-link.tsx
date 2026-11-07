import type { Channel } from '@conduit/contract';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { cn } from '@conduit/ui/lib/utils';
import { IconDots, IconHash, IconLock, IconPencil } from '@tabler/icons-react';
import Link from 'next/link';

import { useHasDraft, useIsUnread } from '@/services/activity/hooks';

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
  // The open conversation is being read, so it never reads as unread.
  const unread = useIsUnread(channel.id) && !isActive;
  const hasDraft = useHasDraft(channel.id) && !isActive;

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
        <span className={cn(unread && 'text-foreground font-semibold')}>
          {channel.name}
        </span>
        {unread && <span className="sr-only">, unread</span>}
        {hasDraft && (
          <>
            <IconPencil
              aria-hidden
              className="text-muted-foreground ml-auto size-3.5"
            />
            <span className="sr-only">, draft</span>
          </>
        )}
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
