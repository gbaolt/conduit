import { ORPCError } from '@orpc/client';
import {
  defaultShouldDehydrateQuery,
  hashKey,
  isServer,
  QueryClient,
} from '@tanstack/react-query';

import { serializer } from '@/lib/serializer';

const RATE_LIMITED = 'TOO_MANY_REQUESTS';

/** Errors that may pass on their own. Any other API error, such as NOT_FOUND, answers the same way every time. */
const TRANSIENT = new Set([
  RATE_LIMITED,
  'INTERNAL_SERVER_ERROR',
  'BAD_GATEWAY',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
]);

/** A network failure is not an `ORPCError`, so it is retried too. */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ORPCError && !TRANSIENT.has(error.code)) return false;
  return failureCount < 3;
}

/** The API limits each user per sliding minute, so a rate-limited query waits 15, 30, then 60 s for it to slide. */
export function retryDelay(attempt: number, error: unknown) {
  const base =
    error instanceof ORPCError && error.code === RATE_LIMITED ? 15_000 : 1000;
  return Math.min(base * 2 ** attempt, 60_000);
}

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
        // A server render must not wait out a retry: the browser retries what the server could not load.
        retry: isServer ? false : shouldRetry,
        retryDelay,
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
