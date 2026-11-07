'use client';

import { Button } from '@conduit/ui/components/button';
import { IconUsersPlus } from '@tabler/icons-react';
import { useState } from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';

import { InviteDialog } from './invite-dialog';

export function InvitePeopleButton() {
  const { activeWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <IconUsersPlus data-icon="inline-start" />
        Invite people
      </Button>
      <InviteDialog
        workspaceName={activeWorkspace?.name ?? 'your workspace'}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
