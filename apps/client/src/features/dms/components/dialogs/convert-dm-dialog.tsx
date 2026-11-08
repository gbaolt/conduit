'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { isDefinedError } from '@orpc/client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { useConvertDm } from '@/services/dms/hooks';

import { ChannelNameField } from '../../../rooms/components/channel-name-field';
import { ChannelNameInputSchema } from '../../../rooms/lib/channel-name-input';
import { useDmDialogs } from '../../context/dm-dialogs-provider';

const ConvertDmFormSchema = z.object({ name: ChannelNameInputSchema });
type ConvertDmInput = z.input<typeof ConvertDmFormSchema>;
type ConvertDmValues = z.output<typeof ConvertDmFormSchema>;

/** Turns the DM into a private channel with a name. The history and the people stay, and you manage it. */
export function ConvertDmDialog({ roomId }: { roomId: string }) {
  const { close } = useDmDialogs();
  const router = useRouter();
  const convert = useConvertDm();

  const { control, handleSubmit, formState, setError } = useForm<
    ConvertDmInput,
    unknown,
    ConvertDmValues
  >({
    resolver: standardSchemaResolver(ConvertDmFormSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = handleSubmit(({ name }) => {
    convert.mutate(
      { roomId, name },
      {
        onSuccess: (channel) => {
          close();
          router.replace(`/channels/${channel.id}`);
        },
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
          <DialogTitle>Turn into a private channel</DialogTitle>
          <DialogDescription>
            Everyone here and every message stays. You become the channel
            manager, and you can add more people.
          </DialogDescription>
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
              status={convert.isPending ? 'loading' : 'idle'}
            >
              Turn into channel
            </StatusButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
