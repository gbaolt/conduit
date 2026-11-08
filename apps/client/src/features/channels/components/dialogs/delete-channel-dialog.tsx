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
import { useDeleteChannel } from '@/services/channels/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { useExitOpenChannel } from '../../lib/use-exit-open-channel';

export function DeleteChannelDialog({ channel }: { channel: Channel }) {
  const { close } = useChannelDialogs();
  const exitOpenChannel = useExitOpenChannel();
  const deleteChannel = useDeleteChannel();

  return (
    <AlertDialog open onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes #{channel.name} and removes everyone from it. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <StatusButton
            variant="destructive"
            status={deleteChannel.isPending ? 'loading' : 'idle'}
            onClick={() =>
              deleteChannel.mutate(
                { channelId: channel.id },
                {
                  onSuccess: () => {
                    close();
                    exitOpenChannel(channel.id);
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            Delete channel
          </StatusButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
