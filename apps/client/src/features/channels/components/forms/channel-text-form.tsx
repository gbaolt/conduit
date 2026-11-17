'use client';

import {
  CHANNEL_TEXT_MAX,
  type Room,
  UpdateChannelInputSchema,
} from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { FormInputGroup } from '@/components/form/form-input';
import { FormTextareaGroup } from '@/components/form/form-textarea';
import { useUpdateChannel } from '@/services/channels/hooks';

export type TextField = 'topic' | 'description';

const TextFormSchema = z.object({ text: UpdateChannelInputSchema.shape.topic });
type TextFormInput = z.input<typeof TextFormSchema>;
type TextFormValues = z.output<typeof TextFormSchema>;

export function ChannelTextForm({
  channel,
  field,
  label,
  onDone,
}: {
  channel: Room;
  field: TextField;
  label: string;
  onDone: () => void;
}) {
  const updateChannel = useUpdateChannel();
  const { control, handleSubmit, formState } = useForm<
    TextFormInput,
    unknown,
    TextFormValues
  >({
    resolver: standardSchemaResolver(TextFormSchema),
    mode: 'onChange',
    defaultValues: { text: channel[field] ?? '' },
  });
  const text = useWatch({ control, name: 'text' }) ?? '';
  const counter = (
    <span className="text-muted-foreground text-xs tabular-nums">
      {CHANNEL_TEXT_MAX - text.trim().length}
    </span>
  );

  const onSubmit = handleSubmit(({ text }) => {
    updateChannel.mutate(
      { roomId: channel.id, [field]: text },
      { onSuccess: onDone, onError: (e) => toast.error(e.message) }
    );
  });

  return (
    <form className="flex flex-col gap-2 pt-1" onSubmit={onSubmit}>
      {field === 'topic' ? (
        <FormInputGroup
          control={control}
          name="text"
          autoFocus
          aria-label={label}
          rightAddon={counter}
        />
      ) : (
        <FormTextareaGroup
          control={control}
          name="text"
          autoFocus
          aria-label={label}
          rightAddon={counter}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="xs" onClick={onDone}>
          Cancel
        </Button>
        <StatusButton
          type="submit"
          size="xs"
          disabled={!formState.isValid}
          status={updateChannel.isPending ? 'loading' : 'idle'}
        >
          Save
        </StatusButton>
      </div>
    </form>
  );
}
