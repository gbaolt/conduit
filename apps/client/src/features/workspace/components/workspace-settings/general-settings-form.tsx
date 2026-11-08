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

import { buttonStatus, StatusButton } from '@/components/async/status-button';
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

import { SettingsSection } from './settings-view';

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
    <div className="flex items-center gap-5">
      <WorkspaceIcon logo={logo} size={64} className="size-16 rounded-xl" />
      <div className="flex flex-col items-start gap-2">
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
          {upload.isPending ? 'Uploading...' : 'Upload image'}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
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
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
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
          description="Lowercase letters, numbers, and hyphens. Changing it breaks links people saved."
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
        className="self-end"
        status={buttonStatus(update)}
        successLabel="Saved"
      >
        Save changes
      </StatusButton>
    </form>
  );
}

export function GeneralSettingsForm() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) return null;

  return (
    <>
      <SettingsSection
        id="icon-heading"
        title="Icon"
        description="Shown in the sidebar, the workspace switcher, and on join links. PNG, JPEG, or WebP, up to 1 MB."
      >
        <IconPicker logo={activeWorkspace.logo} />
      </SettingsSection>
      <SettingsSection
        id="profile-heading"
        title="Name and URL"
        description="How the workspace appears to members and in its web address."
      >
        {/* The form reads its defaults once, so a different workspace remounts it. */}
        <Form key={activeWorkspace.id} workspace={activeWorkspace} />
      </SettingsSection>
    </>
  );
}
