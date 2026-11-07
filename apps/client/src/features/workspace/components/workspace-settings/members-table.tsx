'use client';

import type { WorkspaceMember } from '@conduit/contract';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@conduit/ui/components/avatar';
import { Badge } from '@conduit/ui/components/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@conduit/ui/components/table';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';

import { sessionQuery } from '@/services/auth/queries';
import { membersQuery } from '@/services/workspaces/queries';

import { InvitePeopleButton } from './invite-people-button';
import { MemberActions } from './member-actions';
import { SettingsHeader, SettingsPanel } from './settings-view';

const joinedFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

function summary(members: WorkspaceMember[]) {
  const deactivated = members.filter(
    (member) => member.status === 'deactivated'
  ).length;
  const people = `${members.length} ${members.length === 1 ? 'person' : 'people'} in this workspace`;
  return deactivated > 0
    ? `${people}, ${deactivated} deactivated.`
    : `${people}.`;
}

function MemberCell({
  member,
  isSelf,
}: {
  member: WorkspaceMember;
  isSelf: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-9">
        {member.image ? <AvatarImage src={member.image} alt="" /> : null}
        <AvatarFallback>{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">
          {member.name}
          {isSelf ? (
            <span className="text-muted-foreground font-normal"> (you)</span>
          ) : null}
        </span>
        <span className="text-muted-foreground truncate">{member.email}</span>
      </div>
    </div>
  );
}

export function MembersView() {
  const { data: members } = useSuspenseQuery(membersQuery);
  const { data: session } = useQuery(sessionQuery);

  return (
    <>
      <SettingsHeader
        title="Members"
        description={summary(members)}
        action={<InvitePeopleButton />}
      />
      <SettingsPanel>
        <Table>
          <caption className="sr-only">Workspace members</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Joined
              </TableHead>
              <TableHead className="w-12 pe-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow
                key={member.memberId}
                className={
                  member.status === 'deactivated' ? 'opacity-60' : undefined
                }
              >
                <TableCell className="max-w-72 py-3 ps-4">
                  <MemberCell
                    member={member}
                    isSelf={member.userId === session?.user.id}
                  />
                </TableCell>
                <TableCell className="capitalize">{member.role}</TableCell>
                <TableCell>
                  {member.status === 'deactivated' ? (
                    <Badge variant="outline">Deactivated</Badge>
                  ) : (
                    <span className="text-muted-foreground">Active</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                  {joinedFormat.format(member.joinedAt)}
                </TableCell>
                <TableCell className="pe-4 text-right">
                  <MemberActions member={member} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SettingsPanel>
    </>
  );
}
