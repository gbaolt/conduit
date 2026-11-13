import { Suspense } from 'react';

import { InvitationsTable } from '@/features/workspace/components/workspace-settings/invitations-table';
import { InvitePeopleButton } from '@/features/workspace/components/workspace-settings/invite-people-button';
import { SettingsInvitationsSkeleton } from '@/features/workspace/components/workspace-settings/settings-skeletons';
import { SettingsHeader } from '@/features/workspace/components/workspace-settings/settings-view';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { workspaceInvitationsQuery } from '@/services/workspaces/queries';

async function InvitationsContent() {
  const client = getQueryClient();
  await client.prefetchQuery(workspaceInvitationsQuery);

  return (
    <HydrateClient client={client}>
      <InvitationsTable />
    </HydrateClient>
  );
}

export default function InvitationsPage() {
  return (
    <>
      <SettingsHeader
        title="Invitations"
        description="People you invited who have not joined yet. Each invitation link works for 7 days."
        action={<InvitePeopleButton />}
      />
      <Suspense fallback={<SettingsInvitationsSkeleton />}>
        <InvitationsContent />
      </Suspense>
    </>
  );
}
