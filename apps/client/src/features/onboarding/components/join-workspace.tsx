'use client';

import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { StatusButton } from '@/components/async/status-button';
import { withCallbackURL } from '@/lib/callback-url';
import { useJoinWithLink } from '@/services/workspaces/hooks';
import { joinLinkPreviewQuery } from '@/services/workspaces/queries';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function JoinWorkspace({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const preview = useQuery(joinLinkPreviewQuery(token));
  const join = useJoinWithLink();
  const returnTo = `/join/${encodeURIComponent(token)}`;

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

  const { organizationName } = preview.data;

  if (!signedIn) {
    return (
      <Panel title={`Join ${organizationName}`}>
        <p className="text-muted-foreground">
          Sign in or create an account to join this workspace.
        </p>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            render={
              <Link href={withCallbackURL('/sign-in', returnTo) as Route} />
            }
          >
            Sign in to join
          </Button>
          <Button
            nativeButton={false}
            render={
              <Link href={withCallbackURL('/sign-up', returnTo) as Route} />
            }
            variant="outline"
          >
            Create an account
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={`Join ${organizationName}`}>
      <p className="text-muted-foreground">
        You will join as a member and see the channels everyone starts in.
      </p>
      <StatusButton
        status={join.isPending || join.isSuccess ? 'loading' : 'idle'}
        onClick={() =>
          join.mutate({ token }, { onSuccess: () => router.push('/') })
        }
      >
        Join
      </StatusButton>
      {join.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {join.error.message}
        </p>
      ) : null}
    </Panel>
  );
}
