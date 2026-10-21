import type { contract } from '@conduit/contract';
import { createORPCClient } from '@orpc/client';
import type { RouterContractClient } from '@orpc/contract';
import {
  createTanstackQueryUtils,
  type RouterUtils,
} from '@orpc/tanstack-query';

import { createOrpcLink } from './orpc-link';

export const client: RouterContractClient<typeof contract> =
  createORPCClient(createOrpcLink());

export const orpc: RouterUtils<typeof client> =
  createTanstackQueryUtils(client);
