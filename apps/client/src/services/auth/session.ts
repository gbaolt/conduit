import 'server-only';

import { cache } from 'react';

import { orpc } from '@/lib/orpc';
import { getQueryClient } from '@/lib/query/hydration';

export const sessionQueryOptions = orpc.users.getSession.queryOptions();

export function getSession() {
  const session = cache(() => getQueryClient().fetchQuery(sessionQueryOptions));
  return session();
}
