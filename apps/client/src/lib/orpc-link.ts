import { contract } from '@conduit/contract';
import { ResponseValidationLinkPlugin } from '@orpc/contract/plugins';
import { OpenAPILink } from '@orpc/openapi/fetch';

import { getServerBaseUrl } from './env';

export function createOrpcLink(
  getHeaders?: () => Promise<Record<string, string>>
) {
  const base = new URL(getServerBaseUrl());

  return new OpenAPILink(contract, {
    origin: base.origin,
    url: `${base.pathname}${base.search}` as `/${string}`,
    plugins: [new ResponseValidationLinkPlugin(contract)],
    fetch: (url, init) =>
      globalThis.fetch(url, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
      }),
    ...(getHeaders ? { headers: getHeaders } : {}),
  });
}
