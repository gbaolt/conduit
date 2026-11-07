'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@conduit/ui/components/table';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useRevokeInvitation } from '@/services/workspaces/hooks';
import { workspaceInvitationsQuery } from '@/services/workspaces/queries';

import { SettingsPanel } from './settings-view';

const expiresFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

/** The pending invitations. The page's header stays outside the Suspense boundary that waits for this. */
export function InvitationsTable() {
  const { data: invitations } = useSuspenseQuery(workspaceInvitationsQuery);
  const revoke = useRevokeInvitation();

  return (
    <SettingsPanel>
      {invitations.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          Invitations you send appear here until they are accepted or expire.
        </p>
      ) : (
        <Table>
          <caption className="sr-only">Pending invitations</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Invited by</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Expires
              </TableHead>
              <TableHead className="w-24 pe-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="max-w-72 truncate py-3 ps-4 font-medium">
                  {invitation.email}
                </TableCell>
                <TableCell className="capitalize">{invitation.role}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {invitation.inviterName}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                  {expiresFormat.format(invitation.expiresAt)}
                </TableCell>
                <TableCell className="pe-4 text-right">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SettingsPanel>
  );
}
