import { contract } from '@conduit/contract';
import { ResponseValidationLinkPlugin } from '@orpc/contract/plugins';
import { OpenAPILink } from '@orpc/openapi/fetch';

import { getServerBaseUrl } from './env';

/** Per-call options. `keepalive` lets a small request finish after the page unloads. */
export type OrpcClientContext = { keepalive?: boolean };

export function createOrpcLink(
  getHeaders?: () => Promise<Record<string, string>>
) {
  const base = new URL(getServerBaseUrl());

  return new OpenAPILink<OrpcClientContext>(contract, {
    origin: base.origin,
    url: `${base.pathname}${base.search}` as `/${string}`,
    plugins: [new ResponseValidationLinkPlugin(contract)],
    fetch: (url, init, { context }) =>
      globalThis.fetch(url, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        keepalive: context.keepalive,
      }),
    ...(getHeaders ? { headers: getHeaders } : {}),
  });
}
