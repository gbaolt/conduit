import type { contract } from '@conduit/contract';
import { createORPCClient } from '@orpc/client';
import type { RouterContractClient } from '@orpc/contract';
import {
  createTanstackQueryUtils,
  type RouterUtils,
} from '@orpc/tanstack-query';

import { createOrpcLink } from './orpc-link';

// Next replaces this check at build time, so the server client never reaches the browser bundle.
if (typeof window === 'undefined') {
  await import('./orpc.server');
}

declare global {
  var $client: RouterContractClient<typeof contract> | undefined;
}

export const client: RouterContractClient<typeof contract> =
  globalThis.$client ?? createORPCClient(createOrpcLink());

export const orpc: RouterUtils<typeof client> =
  createTanstackQueryUtils(client);
