import 'server-only';

import { unauthorized } from 'next/navigation';

import { getQueryClient } from '@/lib/query/hydration';

import { sessionQuery } from './queries';

/** The signed-in user's session. A request without one renders the unauthorized page. */
export async function requireSession() {
  // eslint-disable-next-line no-restricted-syntax -- open: a refused session check still loses the page, and rendering without one is an auth decision.
  const session = await getQueryClient().fetchQuery(sessionQuery);
  if (!session) unauthorized();
  return session;
}
