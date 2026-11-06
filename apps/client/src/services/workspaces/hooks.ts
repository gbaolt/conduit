'use client';

import type { WorkspaceRole } from '@conduit/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { client, orpc } from '@/lib/orpc';
import { authClient } from '@/services/auth/client';

import {
  allowedDomainsQuery,
  joinLinkQuery,
  membersQuery,
  workspaceInvitationsQuery,
} from './queries';

// Every change to memberships or the active workspace must refresh the same things.
function useActiveWorkspaceChanged() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.organizations.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.channels.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.members.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.invitations.key() });

    // Better Auth's own atoms don't see changes made through oRPC.
    authClient.$store.notify('$activeOrgSignal');
    authClient.$store.notify('$listOrg');
  };
}

// shortcut: reads Better Auth's client atom, a second cache beside TanStack's
// derive it from sessionQuery if the two drift.
export function useActiveWorkspace() {
  return authClient.useActiveOrganization();
}

/** The viewer's role in the active workspace. Plain `member` until it loads, so nothing privileged flashes in; the server enforces the real rule. */
export function useWorkspaceRole(): WorkspaceRole {
  const { data } = authClient.useActiveMemberRole();
  // Better Auth stores multiple roles comma-separated; same mapping as the server's findWorkspaceRole.
  const roles = data?.role.split(',').map((role) => role.trim()) ?? [];

  return roles.includes('owner')
    ? 'owner'
    : roles.includes('admin')
      ? 'admin'
      : 'member';
}

export function useCreateWorkspace() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation(
    orpc.organizations.create.mutationOptions({ onSuccess: onChanged })
  );
}

export function useUpdateWorkspace() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation(
    orpc.organizations.update.mutationOptions({ onSuccess: onChanged })
  );
}

/** Uploads the file to storage, then saves its public URL as the workspace logo. */
export function useUploadWorkspaceIcon() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, publicUrl } = await client.organizations.iconUploadUrl(
        {
          contentType: file.type,
          size: file.size,
        }
      );
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) throw new Error('The upload failed. Try again.');

      return client.organizations.update({ logo: publicUrl });
    },
    onSuccess: onChanged,
  });
}

export function useAcceptInvitation() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation(
    orpc.invitations.accept.mutationOptions({ onSuccess: onChanged })
  );
}

export function useSwitchWorkspace() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } = await authClient.organization.setActive({
        organizationId,
      });

      if (error) {
        throw new Error(error.message ?? 'Could not switch workspace.');
      }
    },
    onSuccess: onChanged,
  });
}

export function useWorkspaceMembers() {
  return useQuery(membersQuery);
}

function useInvalidateMembers() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: orpc.members.key() });
}

export function useUpdateMemberRole() {
  const invalidate = useInvalidateMembers();

  return useMutation(
    orpc.members.updateRole.mutationOptions({ onSuccess: invalidate })
  );
}

export function useRemoveMember() {
  const invalidate = useInvalidateMembers();

  return useMutation(
    orpc.members.remove.mutationOptions({ onSuccess: invalidate })
  );
}

export function useDeactivateMember() {
  const invalidate = useInvalidateMembers();

  return useMutation(
    orpc.members.deactivate.mutationOptions({ onSuccess: invalidate })
  );
}

export function useReactivateMember() {
  const invalidate = useInvalidateMembers();

  return useMutation(
    orpc.members.reactivate.mutationOptions({ onSuccess: invalidate })
  );
}

export function useWorkspaceInvitations() {
  return useQuery(workspaceInvitationsQuery);
}

function useInvalidateInvitations() {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({
      queryKey: workspaceInvitationsQuery.queryKey,
    });
}

export function useCreateInvitations() {
  const invalidate = useInvalidateInvitations();

  return useMutation(
    orpc.invitations.create.mutationOptions({ onSuccess: invalidate })
  );
}

export function useRevokeInvitation() {
  const invalidate = useInvalidateInvitations();

  return useMutation(
    orpc.invitations.revoke.mutationOptions({ onSuccess: invalidate })
  );
}

export function useJoinLink() {
  return useQuery(joinLinkQuery);
}

export function useResetJoinLink() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.joinLink.reset.mutationOptions({
      onSuccess: (link) =>
        queryClient.setQueryData(joinLinkQuery.queryKey, link),
    })
  );
}

export function useJoinWithLink() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation(
    orpc.joinLink.join.mutationOptions({ onSuccess: onChanged })
  );
}

export function useAllowedDomains() {
  return useQuery(allowedDomainsQuery);
}

export function useSetAllowedDomains() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.allowedDomains.set.mutationOptions({
      onSuccess: (domains) =>
        queryClient.setQueryData(allowedDomainsQuery.queryKey, domains),
    })
  );
}

export function useJoinOrganization() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation(
    orpc.organizations.join.mutationOptions({ onSuccess: onChanged })
  );
}
