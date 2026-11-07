'use client';

import { Button } from '@conduit/ui/components/button';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useRevokeInvitation } from '@/services/workspaces/hooks';
import { workspaceInvitationsQuery } from '@/services/workspaces/queries';

const expiresFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

export function InvitationsTable() {
  const { data: invitations } = useSuspenseQuery(workspaceInvitationsQuery);
  const revoke = useRevokeInvitation();

  if (invitations.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No pending invitations.</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Pending invitations</caption>
      <thead>
        <tr className="text-muted-foreground border-b text-left">
          <th scope="col" className="py-2 pe-3 font-medium">
            Email
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Role
          </th>
          <th
            scope="col"
            className="hidden px-3 py-2 font-medium sm:table-cell"
          >
            Invited by
          </th>
          <th
            scope="col"
            className="hidden px-3 py-2 font-medium sm:table-cell"
          >
            Expires
          </th>
          <th scope="col" className="py-2 ps-3">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {invitations.map((invitation) => (
          <tr key={invitation.id} className="border-b last:border-b-0">
            <th scope="row" className="min-w-0 py-3 pe-3 text-left font-normal">
              <div className="max-w-48 truncate font-medium sm:max-w-64">
                {invitation.email}
              </div>
            </th>
            <td className="px-3 py-3 capitalize">{invitation.role}</td>
            <td className="text-muted-foreground hidden px-3 py-3 sm:table-cell">
              {invitation.inviterName}
            </td>
            <td className="text-muted-foreground hidden px-3 py-3 sm:table-cell">
              {expiresFormat.format(invitation.expiresAt)}
            </td>
            <td className="py-3 ps-3 text-right">
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  revoke.isPending &&
                  revoke.variables.invitationId === invitation.id
                }
                aria-label={`Revoke invitation for ${invitation.email}`}
                onClick={() =>
                  revoke.mutate(
                    { invitationId: invitation.id },
                    { onError: (error) => toast.error(error.message) }
                  )
                }
              >
                Revoke
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
