import { type ReactNode, Suspense } from 'react';

import { AppShell } from '@/components/app-shell';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { requireSession } from '@/services/auth/server';
import { requireWorkspaces } from '@/services/workspaces/server';

async function DashboardShell({ children }: { children: ReactNode }) {
  const session = await requireSession();

  await requireWorkspaces();

  return (
    <HydrateClient client={getQueryClient()}>
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
