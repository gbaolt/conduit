'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { withCallbackURL } from '@/lib/callback-url';

import { authClient } from './client';

/** `returnTo` is where sign-in sends the visitor back afterwards. */
export function useSignOut(returnTo?: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut();

      if (error) {
        throw new Error(error.message ?? 'Sign-out failed. Please try again.');
      }
    },
    onSuccess: () => {
      queryClient.clear();
      router.push(withCallbackURL('/sign-in', returnTo) as Route);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
