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
import { FieldGroup } from '@conduit/ui/components/field';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { isDefinedError } from '@orpc/client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { FormCheckbox } from '@/components/form/form-checkbox';
import { useCreateChannel } from '@/services/channels/hooks';

import { ChannelNameField } from '../../../rooms/components/channel-name-field';
import { ChannelNameInputSchema } from '../../../rooms/lib/channel-name-input';
import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { useCanCreateChannel } from '../../lib/use-can-create-channel';

const CreateChannelFormSchema = z.object({
  name: ChannelNameInputSchema,
  isPrivate: z.boolean(),
});
type CreateChannelInput = z.input<typeof CreateChannelFormSchema>;
type CreateChannelValues = z.output<typeof CreateChannelFormSchema>;

export function CreateChannelDialog() {
  const router = useRouter();
  const { close } = useChannelDialogs();
  const createChannel = useCreateChannel();
  // A member who cannot create public channels can only make private ones.
  const canCreatePublic = useCanCreateChannel('public');

  const { control, handleSubmit, formState, setError } = useForm<
    CreateChannelInput,
    unknown,
    CreateChannelValues
  >({
    resolver: standardSchemaResolver(CreateChannelFormSchema),
    mode: 'onChange',
    defaultValues: { name: '', isPrivate: !canCreatePublic },
  });

  const onSubmit = handleSubmit(({ name, isPrivate }) => {
    createChannel.mutate(
      { name, visibility: isPrivate ? 'private' : 'public' },
      {
        onSuccess: (channel) => {
          close();
          router.push(`/channels/${channel.id}`);
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
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where your team talks about a topic.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <FieldGroup>
            <ChannelNameField control={control} name="name" />
            {canCreatePublic ? (
              <FormCheckbox
                control={control}
                name="isPrivate"
                label="Make private"
                description="Only people you add can find and read it."
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Only admins can create public channels, so this channel will be
                private.
              </p>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <StatusButton
              type="submit"
              disabled={!formState.isValid}
              status={createChannel.isPending ? 'loading' : 'idle'}
            >
              Create channel
            </StatusButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
