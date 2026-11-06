'use client';

import { Badge } from '@conduit/ui/components/badge';
import { useSuspenseQuery } from '@tanstack/react-query';

import { membersQuery } from '@/services/workspaces/queries';

const joinedFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

export function MembersTable() {
  const { data: members } = useSuspenseQuery(membersQuery);

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Workspace members</caption>
      <thead>
        <tr className="text-muted-foreground border-b text-left">
          <th scope="col" className="py-2 pe-3 font-medium">
            Member
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Role
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Status
          </th>
          <th
            scope="col"
            className="hidden px-3 py-2 font-medium sm:table-cell"
          >
            Joined
          </th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.memberId} className="border-b last:border-b-0">
            <th scope="row" className="min-w-0 py-3 pe-3 text-left font-normal">
              <div className="max-w-48 truncate font-medium sm:max-w-64">
                {member.name}
              </div>
              <div className="text-muted-foreground max-w-48 truncate sm:max-w-64">
                {member.email}
              </div>
            </th>
            <td className="px-3 py-3 capitalize">{member.role}</td>
            <td className="px-3 py-3">
              <Badge
                variant={member.status === 'active' ? 'secondary' : 'outline'}
                className="capitalize"
              >
                {member.status}
              </Badge>
            </td>
            <td className="text-muted-foreground hidden px-3 py-3 sm:table-cell">
              {joinedFormat.format(member.joinedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
