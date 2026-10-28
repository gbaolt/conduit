import { createORPCClient } from '@orpc/client';

import { createOrpcLink } from './orpc-link';

// One instance serves every request, so the incoming cookie is read per call, not captured here.
globalThis.$client = createORPCClient(
  createOrpcLink(async (): Promise<Record<string, string>> => {
    // Imported lazily: a static import fails the build in the client-component SSR graph.
    const { headers } = await import('next/headers');
    const cookie = (await headers()).get('cookie');

    return cookie ? { cookie } : {};
  })
);
