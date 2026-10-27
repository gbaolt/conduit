import {
  defaultShouldDehydrateQuery,
  hashKey,
  QueryClient,
} from '@tanstack/react-query';

import { serializer } from '@/lib/serializer';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn(queryKey) {
          const { json, meta } = serializer.serializeJson(queryKey);
          return hashKey([
            json,
            meta?.map((entry) => JSON.stringify(entry)).sort(),
          ]);
        },
        staleTime: 60 * 1000, // > 0 to prevent immediate refetching on mount
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
        serializeData(data) {
          const { json, meta } = serializer.serializeJson(data);
          return { json, meta };
        },
      },
      hydrate: {
        deserializeData(data) {
          return serializer.deserializeJson(data);
        },
      },
    },
  });
}
