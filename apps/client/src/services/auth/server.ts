import 'server-only';

import { unauthorized } from 'next/navigation';

import { getQueryClient } from '@/lib/query/hydration';

import { sessionQuery } from './queries';

/** The signed-in user's session. A request without one renders the unauthorized page. */
export async function requireSession() {
  // The per-request query client dedupes repeated reads within one render.
  const session = await getQueryClient().fetchQuery(sessionQuery);

  if (!session) unauthorized();

  return session;
}
