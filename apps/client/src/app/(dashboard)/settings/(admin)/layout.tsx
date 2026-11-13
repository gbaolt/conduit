import { canWorkspace } from '@conduit/contract';
import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import { SettingsPageSkeleton } from '@/features/workspace/components/workspace-settings/settings-skeletons';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { requireSession } from '@/services/auth/server';
import { membersQuery } from '@/services/workspaces/queries';

async function AdminGate({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const client = getQueryClient();
  const members = await client.fetchQuery(membersQuery);
  const viewer = members.find((member) => member.userId === session.user.id);

  if (!viewer || !canWorkspace('viewSettings', viewer.role)) redirect('/');

  return <HydrateClient client={client}>{children}</HydrateClient>;
}

/** The workspace areas: only admins and owners get past it. */
export default function AdminSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
