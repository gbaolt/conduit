'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { authClient } from './client';

export function useSignOut() {
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
      router.push('/sign-in');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
