'use client';

import type { Room } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { isDefinedError } from '@orpc/client';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { useRenameChannel } from '@/services/channels/hooks';

import { ChannelNameField } from '../../../rooms/components/channel-name-field';
import { ChannelNameInputSchema } from '../../../rooms/lib/channel-name-input';

const RenameChannelFormSchema = z.object({ name: ChannelNameInputSchema });
type RenameChannelInput = z.input<typeof RenameChannelFormSchema>;
type RenameChannelValues = z.output<typeof RenameChannelFormSchema>;

/** Renames a channel in place, inside its details card. */
export function RenameChannelForm({
  channel,
  onDone,
}: {
  channel: Room;
  onDone: () => void;
}) {
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
        onSuccess: onDone,
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
    <form className="flex flex-col gap-2 pt-1" onSubmit={onSubmit}>
      <ChannelNameField control={control} name="name" label={null} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="xs" onClick={onDone}>
          Cancel
        </Button>
        <StatusButton
          type="submit"
          size="xs"
          disabled={!formState.isValid}
          status={renameChannel.isPending ? 'loading' : 'idle'}
        >
          Save
        </StatusButton>
      </div>
    </form>
  );
}
