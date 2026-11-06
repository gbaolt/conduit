'use client';

import { CreateOrganizationInputSchema } from '@conduit/contract';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
import { FieldGroup } from '@conduit/ui/components/field';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { isDefinedError } from '@orpc/client';
import { IconAlertCircle } from '@tabler/icons-react';
import type { SyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { FormInput } from '@/components/form/form-input';
import {
  useWorkspace,
  type Workspace,
} from '@/features/workspace/context/workspace-provider';
import { useUpdateWorkspace } from '@/services/workspaces/hooks';

type Values = z.infer<typeof CreateOrganizationInputSchema>;

function Form({ workspace }: { workspace: Workspace }) {
  const update = useUpdateWorkspace();
  const { control, handleSubmit, setError } = useForm<Values>({
    resolver: standardSchemaResolver(CreateOrganizationInputSchema),
    defaultValues: { name: workspace.name, slug: workspace.slug },
  });

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) =>
    handleSubmit((values) => {
      update.mutate(values, {
        onError: (error) => {
          if (isDefinedError(error) && error.code === 'SLUG_TAKEN') {
            setError('slug', { message: error.message });
          }
        },
      });
    })(event);

  const error = update.error;
  const formError =
    error && !(isDefinedError(error) && error.code === 'SLUG_TAKEN')
      ? error.message
      : null;

  return (
    <form className="flex max-w-md flex-col gap-5" onSubmit={onSubmit}>
      <FieldGroup>
        <FormInput
          control={control}
          name="name"
          autoComplete="organization"
          label="Name"
        />
        <FormInput
          control={control}
          name="slug"
          autoComplete="off"
          label="URL"
          description="Lowercase letters, numbers, and hyphens."
        />
      </FieldGroup>

      {!!formError && (
        <Alert
          variant="destructive"
          className="bg-destructive/10 border-destructive/20 border"
        >
          <IconAlertCircle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="text-wrap">{formError}</AlertDescription>
        </Alert>
      )}

      <StatusButton
        type="submit"
        className="self-start"
        status={
          update.isPending ? 'loading' : update.isSuccess ? 'success' : 'idle'
        }
        successLabel="Saved"
      >
        Save changes
      </StatusButton>
    </form>
  );
}

export function GeneralSettingsForm() {
  const { activeWorkspace } = useWorkspace();

  // The form reads its defaults once, so a different workspace remounts it.
  return activeWorkspace ? (
    <Form key={activeWorkspace.id} workspace={activeWorkspace} />
  ) : null;
}
