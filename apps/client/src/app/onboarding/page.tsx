import { unauthorized } from 'next/navigation';
import { Suspense } from 'react';

import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard';
import { orpc } from '@/lib/orpc';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { getSession } from '@/services/auth/session';

async function OnboardingContent() {
  const session = await getSession();

  if (!session) return unauthorized();

  const queryClient = getQueryClient();
  // Awaited so the chooser renders whole, without rows popping in after hydration.
  await Promise.all([
    queryClient.prefetchQuery(orpc.organizations.list.queryOptions()),
    queryClient.prefetchQuery(orpc.invitations.list.queryOptions()),
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
