'use client';

import {
  type ChannelCreators,
  DEFAULT_WORKSPACE_SETTINGS,
  type WorkspaceSettings,
} from '@conduit/contract';
import { toast } from 'sonner';

import {
  useUpdateWorkspaceSettings,
  useWorkspaceSettings,
} from '@/services/workspaces/hooks';

const CHOICES: { value: ChannelCreators; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'admins', label: 'Only admins and owners' },
];

function Choice({
  legend,
  name,
  value,
  disabled,
  onChange,
}: {
  legend: string;
  name: keyof WorkspaceSettings;
  value: ChannelCreators;
  disabled?: boolean;
  onChange: (value: ChannelCreators) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {CHOICES.map((choice) => (
        <label
          key={choice.value}
          className="flex items-center gap-2 text-sm has-[:disabled]:opacity-50"
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
            className="size-4"
          />
          {choice.label}
        </label>
      ))}
    </fieldset>
  );
}

export function PermissionsForm() {
  const { data: settings = DEFAULT_WORKSPACE_SETTINGS, isPending } =
    useWorkspaceSettings();
  const update = useUpdateWorkspaceSettings();

  const change = (input: Partial<WorkspaceSettings>) =>
    update.mutate(input, {
      onError: (error) => toast.error(error.message),
    });

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Choice
        legend="Who can create channels"
        name="channelCreators"
        value={settings.channelCreators}
        disabled={isPending || update.isPending}
        onChange={(channelCreators) => change({ channelCreators })}
      />
      <Choice
        legend="Who can create public channels"
        name="publicChannelCreators"
        value={settings.publicChannelCreators}
        disabled={
          isPending || update.isPending || settings.channelCreators === 'admins'
        }
        onChange={(publicChannelCreators) => change({ publicChannelCreators })}
      />
      <p className="text-muted-foreground text-sm">
        Admins and owners can always create channels. Members who cannot create
        public channels can still create private ones.
      </p>
    </div>
  );
}
