'use client';

import { Button } from '@conduit/ui/components/button';
import { IconArrowLeft } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { orpc } from '@/lib/orpc';

import { CreateWorkspaceForm } from './create-workspace-form';
import { WorkspaceChooser } from './workspace-chooser';

const steps = ['create'] as const;

export function OnboardingWizard({ email }: { email: string }) {
  const [step, setStep] = useQueryState('step', parseAsStringLiteral(steps));
  const workspaces = useQuery(orpc.organizations.list.queryOptions());
  const invitations = useQuery(orpc.invitations.list.queryOptions());
  const hasChoices = !!workspaces.data?.length || !!invitations.data?.length;

  if (step === 'create') {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ms-2.5"
            onClick={() => void setStep(null)}
          >
            <IconArrowLeft data-icon="inline-start" />
            Back
          </Button>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create a workspace
            </h1>
            <p className="text-muted-foreground">
              A workspace is where your team talks and works together.
            </p>
          </div>
        </div>
        <CreateWorkspaceForm />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {hasChoices ? 'Choose a workspace' : 'Set up your workspace'}
        </h1>
        <p className="text-muted-foreground truncate">
          Signed in as <span className="text-foreground">{email}</span>
        </p>
      </div>
      <WorkspaceChooser onCreate={() => void setStep('create')} />
    </div>
  );
}
