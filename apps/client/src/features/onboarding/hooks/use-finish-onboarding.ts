'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { orpc } from '@/lib/orpc';
import { authClient } from '@/services/auth/client';

export function useFinishOnboarding() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.organizations.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
    // Better Auth's own atoms don't know the server just changed the list and the active workspace.
    authClient.$store.notify('$activeOrgSignal');
    authClient.$store.notify('$listOrg');
    router.push('/');
  };
}
