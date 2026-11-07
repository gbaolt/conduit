import { afterEach, describe, expect, it, vi } from 'vitest';

import { NeonLiveQueries } from './neon-live-queries';

const query = {
  sql: 'SELECT "id" FROM "Message" WHERE "channelId" = $1 AND "updatedAt" >= $2',
  parameters: ['c1', new Date('2026-11-07T00:00:00.000Z')],
};

// "nrt_live_1" followed by 32 key bytes in base64url.
const secret = `nrt_live_1${Buffer.alloc(32, 7).toString('base64url')}`;

afterEach(() => vi.unstubAllEnvs());

describe('NeonLiveQueries', () => {
  it('fails with REALTIME_UNAVAILABLE when Realtime is not configured', async () => {
    vi.stubEnv('NEON_REALTIME_URL', '');
    vi.stubEnv('NEON_REALTIME_SECRET', '');

    await expect(new NeonLiveQueries().seal(query)).rejects.toMatchObject({
      code: 'REALTIME_UNAVAILABLE',
    });
  });

  it('seals a query that expires in about a minute and names the endpoint', async () => {
    vi.stubEnv('NEON_REALTIME_URL', 'wss://live.example/ws');
    vi.stubEnv('NEON_REALTIME_SECRET', secret);
    vi.stubEnv(
      'DATABASE_URL',
      'postgres://u:p@host.neon.tech/neondb?sslmode=require'
    );

    const sealed = await new NeonLiveQueries().seal(query);

    expect(sealed.url).toBe('wss://live.example/ws');
    expect(sealed.capability).not.toContain('SELECT');
    expect(sealed.expiresAt - Date.now()).toBeGreaterThan(50_000);
    expect(sealed.expiresAt - Date.now()).toBeLessThanOrEqual(60_000);
  });

  it('seals the same query to the same fingerprint, so a renewal is accepted', async () => {
    vi.stubEnv('NEON_REALTIME_URL', 'wss://live.example/ws');
    vi.stubEnv('NEON_REALTIME_SECRET', secret);
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@host.neon.tech/neondb');

    const live = new NeonLiveQueries();
    const [first, second] = await Promise.all([
      live.seal(query),
      live.seal(query),
    ]);

    expect(second.queryFingerprint).toBe(first.queryFingerprint);
    expect(second.capability).not.toBe(first.capability);
  });
});
