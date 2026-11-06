import { Suspense } from 'react';

import { InvitationsTable } from '@/features/workspace-settings/components/invitations-table';
import { InvitePeopleButton } from '@/features/workspace-settings/components/invite-people-button';
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
    <section
      aria-labelledby="invitations-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="invitations-heading" className="text-base font-semibold">
          Invitations
        </h2>
        <InvitePeopleButton />
      </div>
      <Suspense>
        <InvitationsContent />
      </Suspense>
    </section>
  );
}
