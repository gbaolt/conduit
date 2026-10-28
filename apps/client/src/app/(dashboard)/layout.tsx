import { redirect, unauthorized } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import { AppShell } from '@/components/app-shell';
import { orpc } from '@/lib/orpc.server';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { getSession } from '@/services/auth/session';

async function DashboardShell({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) return unauthorized();

  const queryClient = getQueryClient();
  const workspaces = await queryClient.fetchQuery(
    orpc.organizations.list.queryOptions()
  );

  if (workspaces.length === 0) return redirect('/onboarding');

  return (
    <HydrateClient client={queryClient}>
      <AppShell
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
      >
        {children}
      </AppShell>
    </HydrateClient>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="bg-background min-h-svh" />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
