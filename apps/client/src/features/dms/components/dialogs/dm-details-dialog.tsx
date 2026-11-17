'use client';

import type { Dm, DmMember } from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import { Dialog, DialogTitle } from '@conduit/ui/components/dialog';
import { Tabs, TabsContent } from '@conduit/ui/components/tabs';
import { IconMail, IconUserPlus, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { PresenceDot } from '@/components/presence-dot';
import { UserAvatar } from '@/components/user-avatar';
import {
  RoomDetailsActions,
  RoomDetailsBody,
  RoomDetailsCard,
  RoomDetailsContent,
  RoomDetailsHeader,
  RoomDetailsId,
  RoomDetailsRow,
  RoomDetailsTab,
  RoomDetailsTabList,
} from '@/features/rooms/components/room-details';
import { usePresenceStatus } from '@/services/activity/hooks';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { useDm } from '@/services/dms/hooks';
import { roomMembersQuery } from '@/services/rooms/queries';

import { useDmDialogs } from '../../context/dm-dialogs-provider';

/** The people the DM is with, the viewer left out unless it is their own notes. */
function othersOf(dm: Dm, viewerId: string) {
  const others = dm.members.filter((member) => member.userId !== viewerId);
  return others.length ? others : dm.members;
}

/** One person's large picture, or up to three overlapping for a group. */
function DmDetailsPicture({ people }: { people: DmMember[] }) {
  const [person] = people;

  if (people.length === 1 && person) {
    return (
      <span className="relative shrink-0">
        <span aria-hidden className="contents">
          <UserAvatar
            name={person.name}
            image={person.image}
            className="size-14 rounded-lg text-xl"
          />
        </span>
        <PresenceDot
          userId={person.userId}
          className="ring-popover absolute -right-0.5 -bottom-0.5 size-3"
        />
      </span>
    );
  }

  return (
    <span aria-hidden className="flex shrink-0 -space-x-3">
      {people.slice(0, 3).map((member) => (
        <UserAvatar
          key={member.userId}
          name={member.name}
          image={member.image}
          className="ring-popover size-10 rounded-lg ring-2"
        />
      ))}
    </span>
  );
}

/** How to reach the one person a DM is with: whether they are around, and their email. */
function DmDetailsPerson({
  roomId,
  person,
}: {
  roomId: string;
  person: DmMember;
}) {
  const status = usePresenceStatus(person.userId);
  const { data: email } = useQuery({
    ...roomMembersQuery(roomId),
    select: (members) =>
      members.find((member) => member.userId === person.userId)?.email,
  });

  return (
    <RoomDetailsCard>
      <section className="flex flex-col gap-2 px-4 py-3 text-sm">
        <p className="flex items-center gap-2">
          <span className="flex size-4 items-center justify-center">
            <PresenceDot userId={person.userId} className="ring-card" />
          </span>
          {status === 'online' ? 'Active now' : 'Away'}
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <IconMail
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          {email ? (
            <a
              href={`mailto:${email}`}
              className="text-link truncate underline-offset-4 hover:underline"
            >
              {email}
            </a>
          ) : (
            <span className="text-muted-foreground">Loading email…</span>
          )}
        </p>
      </section>
    </RoomDetailsCard>
  );
}

function DmDetailsAbout({ dm, viewerId }: { dm: Dm; viewerId: string }) {
  const { open } = useDmDialogs();
  const others = othersOf(dm, viewerId);
  const [person] = others;

  return (
    <div className="flex flex-col gap-3">
      {others.length === 1 && person && (
        <DmDetailsPerson roomId={dm.id} person={person} />
      )}
      <RoomDetailsCard>
        <Button
          variant="ghost"
          className="h-auto justify-start rounded-none px-4 py-3 has-data-[icon=inline-start]:ps-4"
          onClick={() => open({ kind: 'dm-add-people', roomId: dm.id })}
        >
          <IconUserPlus data-icon="inline-start" />
          Add people to this conversation
        </Button>
        <Button
          variant="ghost"
          className="h-auto justify-start rounded-none px-4 py-3 has-data-[icon=inline-start]:ps-4"
          onClick={() => open({ kind: 'dm-convert', roomId: dm.id })}
        >
          <IconUsers data-icon="inline-start" />
          Turn into a private channel
        </Button>
      </RoomDetailsCard>
      <RoomDetailsCard>
        <RoomDetailsRow title="Started">
          <p className="text-sm">{format(dm.createdAt, 'MMMM d, yyyy')}</p>
        </RoomDetailsRow>
      </RoomDetailsCard>
      <RoomDetailsId label="Conversation ID" id={dm.id} />
    </div>
  );
}

function DmDetailsPeople({ dm, viewerId }: { dm: Dm; viewerId: string }) {
  const { open } = useDmDialogs();

  return (
    <RoomDetailsCard>
      <Button
        variant="ghost"
        className="h-auto justify-start rounded-none px-4 py-3 has-data-[icon=inline-start]:ps-4"
        onClick={() => open({ kind: 'dm-add-people', roomId: dm.id })}
      >
        <IconUserPlus data-icon="inline-start" />
        Add people
      </Button>
      <ul>
        {dm.members.map((member) => (
          <li key={member.userId} className="flex items-center gap-2 px-4 py-2">
            <span className="relative">
              <UserAvatar name={member.name} image={member.image} />
              <PresenceDot
                userId={member.userId}
                className="ring-card absolute right-0 bottom-0"
              />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {member.name}
            </p>
            {member.userId === viewerId && (
              <Badge variant="secondary">You</Badge>
            )}
          </li>
        ))}
      </ul>
    </RoomDetailsCard>
  );
}

/** Who a DM is with and what can be done with it. It reads the live DM, so people added while it is open show up. */
export function DmDetailsDialog({ roomId }: { roomId: string }) {
  const { close } = useDmDialogs();
  const { data: session } = useQuery(sessionQuery);
  const dm = useDm(roomId);
  const viewerId = session?.user.id ?? '';

  if (!dm) return null;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && close()}>
      <RoomDetailsContent>
        <RoomDetailsHeader>
          <div className="flex min-w-0 items-center gap-3 pr-8">
            <DmDetailsPicture people={othersOf(dm, viewerId)} />
            <DialogTitle className="truncate text-xl leading-tight font-semibold">
              {dmTitle(dm, viewerId)}
            </DialogTitle>
          </div>
          <RoomDetailsActions room={{ ...dm, kind: 'dm' }} />
        </RoomDetailsHeader>
        <Tabs defaultValue="about" className="min-h-0 gap-0">
          <RoomDetailsTabList>
            <RoomDetailsTab value="about">About</RoomDetailsTab>
            <RoomDetailsTab value="people" count={dm.members.length}>
              People
            </RoomDetailsTab>
          </RoomDetailsTabList>
          <RoomDetailsBody>
            <TabsContent value="about">
              <DmDetailsAbout dm={dm} viewerId={viewerId} />
            </TabsContent>
            <TabsContent value="people">
              <DmDetailsPeople dm={dm} viewerId={viewerId} />
            </TabsContent>
          </RoomDetailsBody>
        </Tabs>
      </RoomDetailsContent>
    </Dialog>
  );
}
