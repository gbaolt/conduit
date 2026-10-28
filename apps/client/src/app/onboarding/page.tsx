import { unauthorized } from 'next/navigation';
import { Suspense } from 'react';

import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { getSession } from '@/services/auth/session';
import {
  invitationsQuery,
  workspacesQuery,
} from '@/services/workspaces/queries';

async function OnboardingContent() {
  const session = await getSession();

  if (!session) return unauthorized();

  const queryClient = getQueryClient();
  // Awaited so the chooser renders whole, without rows popping in after hydration.
  await Promise.all([
    queryClient.prefetchQuery(workspacesQuery),
    queryClient.prefetchQuery(invitationsQuery),
  ]);

  return (
    <HydrateClient client={queryClient}>
      <OnboardingWizard email={session.user.email} />
    </HydrateClient>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}
