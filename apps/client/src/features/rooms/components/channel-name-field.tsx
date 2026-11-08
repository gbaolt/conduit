'use client';

import {
  CHANNEL_NAME_MAX,
  hasNonLatinLetters,
  toChannelName,
} from '@conduit/contract';
import { type FieldPath, type FieldValues, useWatch } from 'react-hook-form';

import type { FormControlProps } from '@/components/form/form-base';
import { FormInput } from '@/components/form/form-input';

/** A name input that shows what the typed text becomes. The form's schema (`ChannelNameInputSchema`) does the normalizing. */
export function ChannelNameField<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>({
  control,
  name,
}: Pick<
  FormControlProps<TFieldValues, FieldPath<TFieldValues>, TTransformedValues>,
  'control' | 'name'
>) {
  const typed = String(useWatch({ control, name }) ?? '');
  const normalized = toChannelName(typed);

  return (
    <FormInput
      control={control}
      name={name}
      label="Name"
      placeholder="e.g. design-team"
      autoComplete="off"
      autoFocus
      descPosition="after-field"
      // A non-Latin name gets the schema's field error instead of a misleading preview.
      description={
        hasNonLatinLetters(typed) ? null : (
          <span className="flex justify-between gap-2">
            <span className="truncate">
              {normalized
                ? `# ${normalized}`
                : 'Lowercase letters, numbers, hyphens, and underscores.'}
            </span>
            <span className="tabular-nums">
              {CHANNEL_NAME_MAX - normalized.length}
            </span>
          </span>
        )
      }
    />
  );
}
