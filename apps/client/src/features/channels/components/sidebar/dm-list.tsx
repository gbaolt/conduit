'use client';

import type { Dm } from '@conduit/contract';
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
import { IconChevronDown, IconPlus, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { UserAvatar } from '@/components/nav-user';
import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle, selfFirst } from '@/services/channels/dm-title';
import { dmsQuery } from '@/services/channels/queries';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { useCollapsedGroups } from '../../lib/use-collapsed-groups';

const DMS_GROUP_ID = 'direct-messages';

/** The picture beside a DM's name: the other person, or a group mark. */
function DmGlyph({ dm, viewerId }: { dm: Dm; viewerId: string }) {
  const others = dm.members.filter((member) => member.userId !== viewerId);
  const person = others.length === 0 ? dm.members[0] : others[0];

  if (others.length > 1 || !person) {
    return <IconUsers aria-hidden />;
  }
  return (
    <UserAvatar
      name={person.name}
      image={person.image}
      className="size-5 rounded-md text-[10px]"
    />
  );
}

function DmLink({
  dm,
  viewerId,
  isActive,
}: {
  dm: Dm;
  viewerId: string;
  isActive: boolean;
}) {
  const title = dmTitle(dm, viewerId);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        className="data-active:text-primary-foreground! data-active:bg-primary!"
        render={
          <Link
            href={`/dms/${dm.id}`}
            aria-current={isActive ? 'page' : undefined}
          />
        }
      >
        <DmGlyph dm={dm} viewerId={viewerId} />
        <span className="truncate">{title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** The viewer's DMs under the channels: the self DM first, then the most recent. */
export function DmList() {
  const { activeWorkspace } = useWorkspace();
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: session } = useQuery(sessionQuery);
  const { roomId } = useParams<{ roomId?: string }>();
  const { isCollapsed, toggle } = useCollapsedGroups(activeWorkspace?.id);
  const { open } = useChannelDialogs();

  const viewerId = session?.user.id ?? '';
  const collapsed = isCollapsed(DMS_GROUP_ID);
  // A collapsed group still shows the open DM, so the viewer keeps their place.
  const shown = selfFirst(dms, viewerId).filter(
    (dm) => !collapsed || dm.id === roomId
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        render={
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => toggle(DMS_GROUP_ID)}
            className="hover:bg-sidebar-accent mb-1 gap-1 text-left"
          />
        }
      >
        <IconChevronDown
          className={cn('transition-transform', collapsed && '-rotate-90')}
        />
        <span className="truncate">Direct messages</span>
      </SidebarGroupLabel>
      <SidebarGroupAction
        aria-label="New direct message"
        onClick={() => open({ kind: 'new-dm' })}
      >
        <IconPlus />
      </SidebarGroupAction>
      {shown.length > 0 && (
        <SidebarGroupContent>
          <SidebarMenu>
            {shown.map((dm) => (
              <DmLink
                key={dm.id}
                dm={dm}
                viewerId={viewerId}
                isActive={dm.id === roomId}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}
