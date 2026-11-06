'use client';

import {
  CreateOrganizationInputSchema,
  ICON_CONTENT_TYPES,
  ICON_MAX_BYTES,
} from '@conduit/contract';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
import { Button } from '@conduit/ui/components/button';
import { FieldGroup } from '@conduit/ui/components/field';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { isDefinedError } from '@orpc/client';
import { IconAlertCircle } from '@tabler/icons-react';
import { type ChangeEvent, type SyntheticEvent, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { FormInput } from '@/components/form/form-input';
import { WorkspaceIcon } from '@/features/workspace/components/workspace-icon';
import {
  useWorkspace,
  type Workspace,
} from '@/features/workspace/context/workspace-provider';
import {
  useUpdateWorkspace,
  useUploadWorkspaceIcon,
} from '@/services/workspaces/hooks';

type Values = z.infer<typeof CreateOrganizationInputSchema>;

function IconPicker({ logo }: { logo?: string | null }) {
  const upload = useUploadWorkspaceIcon();
  const input = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!Object.hasOwn(ICON_CONTENT_TYPES, file.type)) {
      return setFileError('Use a PNG, JPEG, or WebP image.');
    }
    if (file.size > ICON_MAX_BYTES) {
      return setFileError('Use an image under 1 MB.');
    }
    setFileError(null);
    upload.mutate(file);
  };

  const error = fileError ?? upload.error?.message;

  return (
    <div className="flex items-center gap-4">
      <WorkspaceIcon logo={logo} size={56} className="size-14" />
      <div className="flex flex-col items-start gap-1">
        <input
          ref={input}
          type="file"
          accept={Object.keys(ICON_CONTENT_TYPES).join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Workspace icon file"
          onChange={onChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? 'Uploading...' : 'Change icon'}
        </Button>
        <p className="text-muted-foreground text-xs">
          PNG, JPEG, or WebP, up to 1 MB.
        </p>
        {error ? (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

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
      <IconPicker logo={workspace.logo} />
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
