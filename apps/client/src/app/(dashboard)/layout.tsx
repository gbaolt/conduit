import { unauthorized } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import { AppShell } from '@/components/app-shell';
import { getSession } from '@/services/auth/session';

async function DashboardShell({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) return unauthorized();

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="bg-background min-h-svh" />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
