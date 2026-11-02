'use client';

import type { Channel } from '@conduit/contract';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@conduit/ui/components/alert-dialog';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useSetChannelVisibility } from '@/services/channels/hooks';

import { useChannelDialogs } from '../context/channel-dialogs-provider';

export function ChangeVisibilityDialog({ channel }: { channel: Channel }) {
  const { close } = useChannelDialogs();
  const setVisibility = useSetChannelVisibility();
  const toPrivate = channel.visibility === 'public';
  const visibility = toPrivate ? 'private' : 'public';

  return (
    <AlertDialog open onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Change #{channel.name} to {visibility}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {toPrivate
              ? `Only its ${channel.memberCount} current ${channel.memberCount === 1 ? 'member keeps' : 'members keep'} access. Everyone else in the workspace loses it and can no longer find it in Browse.`
              : `Everyone in the workspace gains access: they can find #${channel.name} in Browse and join it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <StatusButton
            status={setVisibility.isPending ? 'loading' : 'idle'}
            onClick={() =>
              setVisibility.mutate(
                { channelId: channel.id, visibility },
                {
                  onSuccess: close,
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            Change to {visibility}
          </StatusButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
