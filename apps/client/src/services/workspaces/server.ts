import 'server-only';

import { redirect } from 'next/navigation';

import { getQueryClient } from '@/lib/query/hydration';

import { workspacesQuery } from './queries';

/** The signed-in user's workspaces. A user with none is sent to onboarding. */
export async function requireWorkspaces() {
  const workspaces = await getQueryClient().fetchQuery(workspacesQuery);

  if (workspaces.length === 0) redirect('/onboarding');

  return workspaces;
}
