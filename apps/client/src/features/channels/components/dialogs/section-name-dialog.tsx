'use client';

import {
  type Channel,
  type ChannelSection,
  ChannelSectionNameSchema,
} from '@conduit/contract';
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
import { FormInput } from '@/components/form/form-input';
import {
  useCreateChannelSection,
  useMoveChannelToSection,
  useRenameChannelSection,
} from '@/services/channels/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';

const SectionNameFormSchema = z.object({ name: ChannelSectionNameSchema });
type SectionNameValues = z.infer<typeof SectionNameFormSchema>;

/** Renames `section`, or creates a section and moves `channel` into it when there is none. */
export function SectionNameDialog({
  section,
  channel,
}: {
  section?: ChannelSection;
  channel?: Channel;
}) {
  const { close } = useChannelDialogs();
  const createSection = useCreateChannelSection();
  const renameSection = useRenameChannelSection();
  const moveToSection = useMoveChannelToSection();
  const { isPending } = section ? renameSection : createSection;

  const { control, handleSubmit, formState, setError } =
    useForm<SectionNameValues>({
      resolver: standardSchemaResolver(SectionNameFormSchema),
      mode: 'onChange',
      defaultValues: { name: section?.name ?? '' },
    });

  const onError = (error: Error, isNameTaken: boolean) => {
    if (isNameTaken) {
      setError('name', { message: error.message });
    } else {
      toast.error(error.message);
    }
  };

  const onSubmit = handleSubmit(({ name }) => {
    if (section) {
      renameSection.mutate(
        { sectionId: section.id, name },
        {
          onSuccess: close,
          onError: (error) =>
            onError(
              error,
              isDefinedError(error) && error.code === 'NAME_TAKEN'
            ),
        }
      );
      return;
    }
    createSection.mutate(
      { name },
      {
        onSuccess: (created) => {
          if (channel) {
            moveToSection.mutate({
              channelId: channel.id,
              sectionId: created.id,
            });
          }
          close();
        },
        onError: (error) =>
          onError(error, isDefinedError(error) && error.code === 'NAME_TAKEN'),
      }
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {section ? 'Rename section' : 'New section'}
          </DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <FormInput
            control={control}
            name="name"
            label="Name"
            placeholder="e.g. Projects"
            autoComplete="off"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <StatusButton
              type="submit"
              disabled={!formState.isValid}
              status={isPending ? 'loading' : 'idle'}
            >
              {section ? 'Rename section' : 'Create section'}
            </StatusButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
