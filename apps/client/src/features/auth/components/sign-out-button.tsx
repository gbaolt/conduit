'use client';

import { Button } from '@conduit/ui/components/button';
import { IconLogout } from '@tabler/icons-react';

import { useSignOut } from '@/services/auth/hooks';

export function SignOutButton() {
  const signOut = useSignOut();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate()}
    >
      <IconLogout />
      Sign out
    </Button>
  );
}
