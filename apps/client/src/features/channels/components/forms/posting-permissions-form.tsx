'use client';

import type {
  ChannelAudience,
  ChannelPermissions,
  Room,
} from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { FieldGroup } from '@conduit/ui/components/field';
import { SelectItem } from '@conduit/ui/components/select';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { FormSelect } from '@/components/form/form-select';
import { useSetChannelPermissions } from '@/services/channels/hooks';

const AUDIENCE_LABELS: Record<ChannelAudience, string> = {
  everyone: 'Everyone',
  managers: 'Managers and admins',
};

export const PERMISSIONS: {
  key: keyof ChannelPermissions;
  label: string;
  says: Record<ChannelAudience, string>;
}[] = [
  {
    key: 'post',
    label: 'Who can post',
    says: {
      everyone: 'Everyone can post',
      managers: 'Only managers and admins can post',
    },
  },
  {
    key: 'reply',
    label: 'Who can reply in threads',
    says: {
      everyone: 'Everyone can reply to messages',
      managers: 'Only managers and admins can reply to messages',
    },
  },
  {
    key: 'mentionEveryone',
    label: 'Who can use @channel and @here',
    says: {
      everyone: 'Everyone can use @channel and @here',
      managers: 'Only managers and admins can use @channel and @here',
    },
  },
];

export function PostingPermissionsForm({
  channel,
  onDone,
}: {
  channel: Room;
  onDone: () => void;
}) {
  const setPermissions = useSetChannelPermissions();
  const { control, handleSubmit } = useForm<ChannelPermissions>({
    defaultValues: channel.permissions,
  });

  const onSubmit = handleSubmit((permissions) => {
    setPermissions.mutate(
      { roomId: channel.id, permissions },
      { onSuccess: onDone, onError: (error) => toast.error(error.message) }
    );
  });

  return (
    <form className="flex flex-col gap-4 pt-2" onSubmit={onSubmit}>
      <FieldGroup className="gap-3">
        {PERMISSIONS.map(({ key, label }) => (
          <FormSelect
            key={key}
            control={control}
            name={key}
            label={label}
            items={AUDIENCE_LABELS}
            orientation="horizontal"
            size="sm"
            className="w-48 shrink-0"
          >
            <SelectItem value="everyone">Everyone</SelectItem>
            <SelectItem value="managers">Managers and admins</SelectItem>
          </FormSelect>
        ))}
      </FieldGroup>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="xs" onClick={onDone}>
          Cancel
        </Button>
        <StatusButton
          type="submit"
          size="xs"
          status={setPermissions.isPending ? 'loading' : 'idle'}
        >
          Save
        </StatusButton>
      </div>
    </form>
  );
}
