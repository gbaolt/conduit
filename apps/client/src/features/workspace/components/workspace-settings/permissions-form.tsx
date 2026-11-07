'use client';

import {
  type ChannelCreators,
  ChannelCreatorsSchema,
  DEFAULT_WORKSPACE_SETTINGS,
  type WorkspaceSettings,
} from '@conduit/contract';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@conduit/ui/components/field';
import { RadioGroup, RadioGroupItem } from '@conduit/ui/components/radio-group';
import { toast } from 'sonner';

import {
  useUpdateWorkspaceSettings,
  useWorkspaceSettings,
} from '@/services/workspaces/hooks';

import { SettingsSection } from './settings-view';

type Choice = { value: ChannelCreators; title: string; description: string };

const SETTINGS: {
  key: keyof WorkspaceSettings;
  title: string;
  description: string;
  choices: Choice[];
}[] = [
  {
    key: 'channelCreators',
    title: 'Creating channels',
    description: 'Who can start a new channel, public or private.',
    choices: [
      {
        value: 'everyone',
        title: 'Everyone',
        description: 'Any member can start a channel.',
      },
      {
        value: 'admins',
        title: 'Admins and owners',
        description: 'Members ask an admin to start one for them.',
      },
    ],
  },
  {
    key: 'publicChannelCreators',
    title: 'Public channels',
    description:
      'Who can start a channel that everyone in the workspace can find and join.',
    choices: [
      {
        value: 'everyone',
        title: 'Everyone',
        description: 'Members choose public or private.',
      },
      {
        value: 'admins',
        title: 'Admins and owners',
        description: 'Members can still start private channels.',
      },
    ],
  },
];

export function PermissionsForm() {
  const { data: settings = DEFAULT_WORKSPACE_SETTINGS, isPending } =
    useWorkspaceSettings();
  const update = useUpdateWorkspaceSettings();

  const change = (input: Partial<WorkspaceSettings>) =>
    update.mutate(input, {
      onSuccess: () => toast.success('Permissions saved.'),
      onError: (error) => toast.error(error.message),
    });

  return SETTINGS.map((setting) => {
    // Public channels are moot once only admins can create any channel.
    const locked =
      setting.key === 'publicChannelCreators' &&
      settings.channelCreators === 'admins';

    return (
      <SettingsSection
        key={setting.key}
        id={`${setting.key}-heading`}
        title={setting.title}
        description={
          locked
            ? 'Only admins and owners can start channels, so this follows that setting.'
            : setting.description
        }
      >
        <RadioGroup
          aria-labelledby={`${setting.key}-heading`}
          value={settings[setting.key]}
          disabled={isPending || update.isPending || locked}
          onValueChange={(value) =>
            change({ [setting.key]: ChannelCreatorsSchema.parse(value) })
          }
          className="sm:grid-cols-2"
        >
          {setting.choices.map((choice) => {
            const id = `${setting.key}-${choice.value}`;

            return (
              <FieldLabel key={choice.value} htmlFor={id}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{choice.title}</FieldTitle>
                    <FieldDescription>{choice.description}</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem id={id} value={choice.value} />
                </Field>
              </FieldLabel>
            );
          })}
        </RadioGroup>
      </SettingsSection>
    );
  });
}
