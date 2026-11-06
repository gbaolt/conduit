'use client';

import {
  canWorkspace,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@conduit/contract';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@conduit/ui/components/alert-dialog';
import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { IconDots } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { sessionQuery } from '@/services/auth/queries';
import {
  useRemoveMember,
  useUpdateMemberRole,
  useWorkspaceRole,
} from '@/services/workspaces/hooks';

const ROLES: WorkspaceRole[] = ['owner', 'admin', 'member'];

function RemoveMemberDialog({
  member,
  onClose,
}: {
  member: WorkspaceMember;
  onClose: () => void;
}) {
  const { mutate, isPending } = useRemoveMember();

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {member.name} ({member.email}) loses access to this workspace and
            leaves its channels. They keep their account and can rejoin later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <StatusButton
            variant="destructive"
            status={isPending ? 'loading' : 'idle'}
            onClick={() =>
              mutate(
                { memberId: member.memberId },
                {
                  onSuccess: onClose,
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            Remove {member.name}
          </StatusButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The row menu. It offers only what `canWorkspace` allows the viewer to do to this member. */
export function MemberActions({ member }: { member: WorkspaceMember }) {
  const viewerRole = useWorkspaceRole();
  const { data: session } = useQuery(sessionQuery);
  const updateRole = useUpdateMemberRole();
  const [removing, setRemoving] = useState(false);

  const isSelf = member.userId === session?.user.id;
  const roleChoices = ROLES.filter(
    (role) =>
      role !== member.role &&
      canWorkspace('changeRole', viewerRole, {
        role: member.role,
        newRole: role,
        isSelf,
      })
  );
  const canRemove = canWorkspace('removeMember', viewerRole, {
    role: member.role,
    isSelf,
  });

  if (roleChoices.length === 0 && !canRemove) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${member.name}`}
            />
          }
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {roleChoices.map((role) => (
            <DropdownMenuItem
              key={role}
              className="capitalize"
              onClick={() =>
                updateRole.mutate(
                  { memberId: member.memberId, role },
                  { onError: (error) => toast.error(error.message) }
                )
              }
            >
              Make {role}
            </DropdownMenuItem>
          ))}
          {roleChoices.length > 0 && canRemove ? (
            <DropdownMenuSeparator />
          ) : null}
          {canRemove ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setRemoving(true)}
            >
              Remove from workspace
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {removing ? (
        <RemoveMemberDialog
          member={member}
          onClose={() => setRemoving(false)}
        />
      ) : null}
    </>
  );
}
