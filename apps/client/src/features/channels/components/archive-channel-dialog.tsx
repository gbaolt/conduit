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
import {
  useArchiveChannel,
  useUnarchiveChannel,
} from '@/services/channels/hooks';

import { useChannelDialogs } from '../context/channel-dialogs-provider';

const members = (count: number) =>
  `${count} ${count === 1 ? 'member' : 'members'}`;

/** Archives an active channel and unarchives an archived one. */
export function ArchiveChannelDialog({ channel }: { channel: Channel }) {
  const { close } = useChannelDialogs();
  const archiveChannel = useArchiveChannel();
  const unarchiveChannel = useUnarchiveChannel();
  const isArchived = channel.archivedAt !== null;
  const { mutate, isPending } = isArchived ? unarchiveChannel : archiveChannel;

  return (
    <AlertDialog open onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? 'Unarchive' : 'Archive'} #{channel.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived
              ? `#${channel.name} returns to the sidebar of its ${members(channel.memberCount)}, and people can join and change it again.`
              : `#${channel.name} leaves the sidebar of its ${members(channel.memberCount)} and nobody can join or change it. Its name stays taken. Unarchive it any time.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <StatusButton
            status={isPending ? 'loading' : 'idle'}
            onClick={() =>
              mutate(
                { channelId: channel.id },
                {
                  onSuccess: close,
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            {isArchived ? 'Unarchive' : 'Archive'} channel
          </StatusButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
