import { canWorkspace } from '@conduit/contract';
import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import { SettingsNav } from '@/features/workspace-settings/components/settings-nav';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { requireSession } from '@/services/auth/server';
import { membersQuery } from '@/services/workspaces/queries';

async function AdminGate({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const client = getQueryClient();
  const members = await client.fetchQuery(membersQuery);
  const viewer = members.find((member) => member.userId === session.user.id);

  if (!viewer || !canWorkspace('viewSettings', viewer.role)) redirect('/');

  return (
    <HydrateClient client={client}>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-10 md:px-8">
          <div className="flex flex-col gap-3">
            <h1 className="px-3 text-lg font-semibold">Workspace settings</h1>
            <SettingsNav />
          </div>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
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
