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
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { FormInput } from '@/components/form/form-input';
import { StatusButton } from '@/components/status-button';
import { useCreateWorkspace } from '@/services/workspaces/hooks';

type CreateWorkspaceValues = z.infer<typeof CreateOrganizationInputSchema>;

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '');
}

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [slugEdited, setSlugEdited] = useState(false);
  const createWorkspace = useCreateWorkspace();

  const { control, handleSubmit, formState, setValue, setError } =
    useForm<CreateWorkspaceValues>({
      resolver: standardSchemaResolver(CreateOrganizationInputSchema),
      defaultValues: { name: '', slug: '' },
    });

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) =>
    handleSubmit((values) => {
      createWorkspace.mutate(values, {
        onSuccess: () => router.push('/'),
        onError: (error) => {
          if (isDefinedError(error) && error.code === 'SLUG_TAKEN') {
            setError('slug', { message: error.message });
          }
        },
      });
    })(event);

  const error = createWorkspace.error;
  const formError =
    error && !(isDefinedError(error) && error.code === 'SLUG_TAKEN')
      ? error.message
      : null;
  const revalidate = { shouldValidate: formState.isSubmitted };

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <FieldGroup>
        <FormInput
          control={control}
          name="name"
          autoComplete="organization"
          label="Name"
          placeholder="Acme Inc."
          onChange={(event) => {
            const { value } = event.target;
            setValue('name', value, revalidate);
            if (!slugEdited) setValue('slug', slugify(value), revalidate);
          }}
        />
        <FormInput
          control={control}
          name="slug"
          autoComplete="off"
          label="URL"
          placeholder="acme"
          description="Lowercase letters, numbers, and hyphens."
          onChange={(event) => {
            setSlugEdited(true);
            setValue('slug', event.target.value, revalidate);
          }}
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
        size="lg"
        className="w-full"
        status={
          createWorkspace.isPending
            ? 'loading'
            : createWorkspace.isSuccess
              ? 'success'
              : 'idle'
        }
        successLabel="Workspace created"
      >
        Create workspace
      </StatusButton>
    </form>
  );
}
