import type { Channel } from '@conduit/contract';
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { IconHash, IconLock } from '@tabler/icons-react';
import Link from 'next/link';

export function ChannelLink({
  channel,
  isActive,
}: {
  channel: Channel;
  isActive: boolean;
}) {
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  return (
    <SidebarMenuItem>
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
    </SidebarMenuItem>
  );
}
