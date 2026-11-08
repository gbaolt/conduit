'use client';

import { DEFAULT_AI_SETTINGS } from '@conduit/contract';
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
  useAiSettings,
  useUpdateAiSettings,
} from '@/services/workspaces/hooks';

import { SettingsSection } from './settings-view';

const CHOICES = [
  {
    value: 'on',
    title: 'On',
    description: 'Members can summarize threads and channels.',
  },
  {
    value: 'off',
    title: 'Off',
    description: 'The Summarize entries are hidden and the API refuses.',
  },
];

export function AiSettingsForm() {
  const { data: settings = DEFAULT_AI_SETTINGS, isPending } = useAiSettings();
  const update = useUpdateAiSettings();

  return (
    <SettingsSection
      id="ai-enabled-heading"
      title="AI summaries"
      description="Summaries send the messages a member can read to an AI model. Turn this off to keep messages from leaving Conduit."
    >
      <RadioGroup
        aria-labelledby="ai-enabled-heading"
        value={settings.aiEnabled ? 'on' : 'off'}
        disabled={isPending || update.isPending}
        onValueChange={(value) =>
          update.mutate(
            { aiEnabled: value === 'on' },
            {
              onSuccess: () => toast.success('AI settings saved.'),
              onError: (error) => toast.error(error.message),
            }
          )
        }
        className="sm:grid-cols-2"
      >
        {CHOICES.map((choice) => {
          const id = `ai-enabled-${choice.value}`;

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
}
