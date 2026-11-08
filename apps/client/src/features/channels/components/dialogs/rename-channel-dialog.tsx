'use client';

import type { Room } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { isDefinedError } from '@orpc/client';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { useRenameChannel } from '@/services/channels/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { ChannelNameInputSchema } from '../../lib/channel-name-input';
import { ChannelNameField } from './channel-name-field';

const RenameChannelFormSchema = z.object({ name: ChannelNameInputSchema });
type RenameChannelInput = z.input<typeof RenameChannelFormSchema>;
type RenameChannelValues = z.output<typeof RenameChannelFormSchema>;

export function RenameChannelDialog({ channel }: { channel: Room }) {
  const { close } = useChannelDialogs();
  const renameChannel = useRenameChannel();

  const { control, handleSubmit, formState, setError } = useForm<
    RenameChannelInput,
    unknown,
    RenameChannelValues
  >({
    resolver: standardSchemaResolver(RenameChannelFormSchema),
    mode: 'onChange',
    defaultValues: { name: channel.name },
  });

  const onSubmit = handleSubmit(({ name }) => {
    renameChannel.mutate(
      { roomId: channel.id, name },
      {
        onSuccess: close,
        onError: (error) => {
          if (isDefinedError(error) && error.code === 'NAME_TAKEN') {
            setError('name', { message: error.message });
          } else {
            toast.error(error.message);
          }
        },
      }
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename #{channel.name}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <ChannelNameField control={control} name="name" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <StatusButton
              type="submit"
              disabled={!formState.isValid}
              status={renameChannel.isPending ? 'loading' : 'idle'}
            >
              Rename channel
            </StatusButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
