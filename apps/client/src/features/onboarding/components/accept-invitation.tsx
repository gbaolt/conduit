'use client';

import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { StatusButton } from '@/components/async/status-button';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { useAcceptInvitation } from '@/services/workspaces/hooks';
import { invitationPreviewQuery } from '@/services/workspaces/queries';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function AcceptInvitation({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const router = useRouter();
  const preview = useQuery(invitationPreviewQuery(invitationId));
  const accept = useAcceptInvitation();
  const returnTo = `/accept-invitation?id=${encodeURIComponent(invitationId)}`;

  if (preview.isPending) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (preview.isError) {
    return (
      <Panel title={preview.error.message}>
        <Button
          nativeButton={false}
          render={<Link href="/" />}
          variant="outline"
        >
          Go to Conduit
        </Button>
      </Panel>
    );
  }

  const { organizationName, email: invitedEmail } = preview.data;

  if (invitedEmail.toLowerCase() !== email.toLowerCase()) {
    return (
      <Panel title="This invitation is for someone else">
        <p className="text-muted-foreground">
          {organizationName} invited{' '}
          <span className="text-foreground">{invitedEmail}</span>, but you are
          signed in as <span className="text-foreground">{email}</span>. Sign
          out, then sign in or sign up with {invitedEmail}.
        </p>
        <SignOutButton returnTo={returnTo} />
      </Panel>
    );
  }

  return (
    <Panel title={`Join ${organizationName}`}>
      <p className="text-muted-foreground">
        You were invited as <span className="text-foreground">{email}</span>.
      </p>
      <StatusButton
        status={accept.isPending || accept.isSuccess ? 'loading' : 'idle'}
        onClick={() =>
          accept.mutate({ invitationId }, { onSuccess: () => router.push('/') })
        }
      >
        Accept
      </StatusButton>
      {accept.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {accept.error.message}
        </p>
      ) : null}
    </Panel>
  );
}
