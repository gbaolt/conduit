'use client';

import { Button } from '@conduit/ui/components/button';
import { IconLogout } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { authClient } from '@/services/auth/client';

export function SignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    setPending(true);

    const { error } = await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          queryClient.clear();
          router.push('/sign-in');
          router.refresh();
        },
      },
    });

    if (error) {
      setPending(false);
      toast.error(error.message ?? 'Sign-out failed. Please try again.');
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={handleSignOut}
    >
      <IconLogout />
      Sign out
    </Button>
  );
}
