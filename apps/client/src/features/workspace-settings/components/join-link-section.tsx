'use client';

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
import { IconCopy, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { toAbsoluteAppUrl } from '@/features/auth/lib/callback-url';
import { useJoinLink, useResetJoinLink } from '@/services/workspaces/hooks';

/** Copies the workspace's join link and lets an admin replace it. */
export function JoinLinkSection() {
  const { data: link, isError, error } = useJoinLink();
  const reset = useResetJoinLink();
  const [confirming, setConfirming] = useState(false);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(
        toAbsoluteAppUrl(`/join/${link.token}`)
      );
      toast.success('Join link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        Anyone with the join link can join as a member. Reset it to stop the old
        link working.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!link} onClick={copy}>
          <IconCopy data-icon="inline-start" />
          Copy join link
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!link}
          onClick={() => setConfirming(true)}
        >
          <IconRefresh data-icon="inline-start" />
          Reset link
        </Button>
      </div>
      {isError ? (
        <p role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      ) : null}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the join link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current link stops working for everyone who has it. People
              already in the workspace stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <StatusButton
              variant="destructive"
              status={reset.isPending ? 'loading' : 'idle'}
              onClick={() =>
                reset.mutate(undefined, {
                  onSuccess: () => {
                    setConfirming(false);
                    toast.success('Join link reset.');
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Reset link
            </StatusButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
