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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconCopy, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { toAbsoluteAppUrl } from '@/features/auth/lib/callback-url';
import { useJoinLink, useResetJoinLink } from '@/services/workspaces/hooks';

/** The workspace's join link as a full URL, and a way to copy it. */
export function useCopyJoinLink() {
  const query = useJoinLink();
  const url = query.data ? toAbsoluteAppUrl(`/join/${query.data.token}`) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Join link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  return { ...query, url, copy };
}

/** Shows the workspace's join link and lets an admin replace it. */
export function JoinLinkSection() {
  const { url, isError, error, copy } = useCopyJoinLink();
  const reset = useResetJoinLink();
  const [confirming, setConfirming] = useState(false);

  if (isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {url ? (
        <InputGroup>
          <InputGroupInput
            readOnly
            value={url}
            aria-label="Join link"
            onFocus={(event) => event.currentTarget.select()}
            className="text-muted-foreground"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton onClick={copy}>
              <IconCopy data-icon="inline-start" />
              Copy
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <Skeleton className="h-9 w-full" />
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!url}
        onClick={() => setConfirming(true)}
      >
        <IconRefresh data-icon="inline-start" />
        Reset link
      </Button>
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
