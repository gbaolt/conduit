import { Suspense } from 'react';

import { JoinWorkspace } from '@/features/onboarding/components/join-workspace';
import { getQueryClient } from '@/lib/query/hydration';
import { sessionQuery } from '@/services/auth/queries';

async function JoinContent({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, session] = await Promise.all([
    params,
    getQueryClient().fetchQuery(sessionQuery),
  ]);

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
