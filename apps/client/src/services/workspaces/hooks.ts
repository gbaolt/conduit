'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc';
import { authClient } from '@/services/auth/client';

// Every change to memberships or the active workspace must refresh the same things.
function useActiveWorkspaceChanged() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.organizations.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.users.key() });

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

export function useCreateWorkspace() {
  const onChanged = useActiveWorkspaceChanged();

  return useMutation(
    orpc.organizations.create.mutationOptions({ onSuccess: onChanged })
  );
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
