import { Suspense } from 'react';

import {
  FeedList,
  FeedListSkeleton,
} from '@/features/feed/components/feed-list';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { feedQuery } from '@/services/feed/queries';

export default function ActivityPage() {
  return (
    <Suspense fallback={<FeedListSkeleton />}>
      <Activity />
    </Suspense>
  );
}

async function Activity() {
  const client = getQueryClient();
  await client.prefetchInfiniteQuery(feedQuery('all'));

  return (
    <HydrateClient client={client}>
      <FeedList />
    </HydrateClient>
  );
}
