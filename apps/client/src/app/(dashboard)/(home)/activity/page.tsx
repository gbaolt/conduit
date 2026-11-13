import { Suspense } from 'react';

import {
  FeedList,
  FeedListSkeleton,
} from '@/features/feed/components/feed-list';
import { loadFeedParams } from '@/features/feed/lib/feed-params';
import { getQueryClient, HydrateClient } from '@/lib/query/hydration';
import { feedQuery } from '@/services/feed/queries';

export default function ActivityPage({ searchParams }: PageProps<'/activity'>) {
  return (
    <Suspense fallback={<FeedListSkeleton />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({
  searchParams,
}: Pick<PageProps<'/activity'>, 'searchParams'>) {
  const { show, unread, q } = await loadFeedParams(searchParams);
  const client = getQueryClient();
  await client.prefetchInfiniteQuery(
    feedQuery({ filter: unread ? 'unread' : 'all', sources: show, q })
  );

  return (
    <HydrateClient client={client}>
      <FeedList />
    </HydrateClient>
  );
}
