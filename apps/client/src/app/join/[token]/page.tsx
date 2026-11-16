import { Suspense } from 'react';

import { JoinWorkspace } from '@/features/onboarding/components/join-workspace';
import { getQueryClient } from '@/lib/query/hydration';
import { sessionQuery } from '@/services/auth/queries';

async function JoinContent({ params }: { params: Promise<{ token: string }> }) {
  const client = getQueryClient();
  const [{ token }] = await Promise.all([
    params,
    client.prefetchQuery(sessionQuery),
  ]);
  // A failed session lookup leaves no data, so the page offers sign-in instead of crashing.
  const session = client.getQueryData(sessionQuery.queryKey);

  return <JoinWorkspace token={token} signedIn={!!session} />;
}

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense>
      <JoinContent params={params} />
    </Suspense>
  );
}
