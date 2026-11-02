import type { contract } from '@conduit/contract';
import { createORPCClient } from '@orpc/client';
import type { RouterContractClient } from '@orpc/contract';
import {
  createTanstackQueryUtils,
  type RouterUtils,
} from '@orpc/tanstack-query';

import { createOrpcLink } from './orpc-link';

// No top-level await here: it makes every importer an async module, and Fast Refresh full-reloads those.
async function forwardIncomingCookie(): Promise<Record<string, string>> {
  // Imported lazily: a static import fails the build in the client-component SSR graph.
  const { headers } = await import('next/headers');
  const cookie = (await headers()).get('cookie');

  return cookie ? { cookie } : {};
}

// Next replaces this check at build time, so the server branch never reaches the browser bundle.
export const client: RouterContractClient<typeof contract> = createORPCClient(
  createOrpcLink(
    typeof window === 'undefined' ? forwardIncomingCookie : undefined
  )
);

export const orpc: RouterUtils<typeof client> =
  createTanstackQueryUtils(client);
