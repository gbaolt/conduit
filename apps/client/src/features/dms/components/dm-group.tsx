'use client';

import type { Dm } from '@conduit/contract';
import {
  SidebarGroupAction,
  SidebarMenuItem,
} from '@conduit/ui/components/sidebar';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { UserAvatar } from '@/components/user-avatar';
import {
  RoomGroup,
  RoomGroupContent,
  RoomGroupLabel,
  RoomItem,
  RoomItemButton,
  RoomItemDraft,
  RoomItemLabel,
} from '@/features/rooms/components/room-sidebar';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle, selfFirst } from '@/services/dms/dm-title';
import { dmsQuery } from '@/services/dms/queries';

import { useDmDialogs } from '../context/dm-dialogs-provider';

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

/** The viewer's DMs: the self DM first, then the most recent. */
export function DmGroup() {
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: session } = useQuery(sessionQuery);
  const { open } = useDmDialogs();
  const viewerId = session?.user.id ?? '';

  return (
    <RoomGroup id={DMS_GROUP_ID}>
      <RoomGroupLabel>Direct messages</RoomGroupLabel>
      <SidebarGroupAction
        aria-label="New direct message"
        onClick={() => open({ kind: 'new-dm' })}
      >
        <IconPlus />
      </SidebarGroupAction>
      <RoomGroupContent>
        {selfFirst(dms, viewerId).map((dm) => (
          <RoomItem key={dm.id} roomId={dm.id}>
            <SidebarMenuItem>
              <RoomItemButton href={`/dms/${dm.id}`}>
                <DmGlyph dm={dm} viewerId={viewerId} />
                <RoomItemLabel className="truncate">
                  {dmTitle(dm, viewerId)}
                </RoomItemLabel>
                <RoomItemDraft />
              </RoomItemButton>
            </SidebarMenuItem>
          </RoomItem>
        ))}
      </RoomGroupContent>
    </RoomGroup>
  );
}
