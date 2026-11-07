import { canWorkspace } from '@conduit/contract';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import { SettingsNav } from '@/features/workspace/components/workspace-settings/settings-nav';
import { WorkspaceSidebar } from '@/features/workspace/components/workspace-sidebar';
import {
  LAYOUT_COOKIE,
  parseLayout,
} from '@/features/workspace/lib/layout-cookie';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { requireSession } from '@/services/auth/server';
import { membersQuery } from '@/services/workspaces/queries';

async function AdminGate({ children }: { children: ReactNode }) {
  const [session, cookieStore] = await Promise.all([
    requireSession(),
    cookies(),
  ]);
  const client = getQueryClient();
  const members = await client.fetchQuery(membersQuery);
  const viewer = members.find((member) => member.userId === session.user.id);

  if (!viewer || !canWorkspace('viewSettings', viewer.role)) redirect('/');

  return (
    <HydrateClient client={client}>
      <WorkspaceSidebar
        defaultLayout={parseLayout(cookieStore.get(LAYOUT_COOKIE)?.value)}
        sidebar={<SettingsNav />}
      >
        <main className="mx-auto max-w-4xl px-4 py-8 md:px-10 md:py-10">
          {children}
        </main>
      </WorkspaceSidebar>
    </HydrateClient>
  );
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
