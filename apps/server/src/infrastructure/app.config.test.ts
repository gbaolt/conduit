import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAppOrigin } from './app.config';

afterEach(() => vi.unstubAllEnvs());

describe('app origin provider', () => {
  it('defaults to the HTTP client origin when APP_URL is unset', () => {
    vi.stubEnv('APP_URL', undefined);

    expect(getAppOrigin()).toBe('http://localhost:3000');
  });

  it.each([
    ['https://app.conduit.test:8443/path', 'https://app.conduit.test:8443'],
    ['', ''],
    ['not a URL', ''],
    ['file:///app', ''],
  ])('resolves APP_URL %j to %j', (appUrl, origin) => {
    vi.stubEnv('APP_URL', appUrl);

    expect(getAppOrigin()).toBe(origin);
  });
});
