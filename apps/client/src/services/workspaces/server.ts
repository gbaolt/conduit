import 'server-only';

import { redirect } from 'next/navigation';

import { getQueryClient } from '@/lib/query/hydration';

import { workspacesQuery } from './queries';

/**
 * Sends a user with no workspaces to onboarding. When the list fails to load, such as on a rate limit,
 * the shell renders anyway and the browser fetches the list itself.
 */
export async function requireWorkspaces() {
  const workspaces = await getQueryClient()
    .fetchQuery(workspacesQuery)
    .catch(() => null);

  if (workspaces?.length === 0) redirect('/onboarding');
}
