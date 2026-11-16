import { ORPCError } from '@orpc/client';
import { describe, expect, it } from 'vitest';

import { retryDelay, shouldRetry } from '../client';

const error = (code: string) => new ORPCError(code);

describe('query retries', () => {
  it('stops at once on a client error that will not change', () => {
    expect(shouldRetry(0, error('NOT_FOUND'))).toBe(false);
    expect(shouldRetry(0, error('FORBIDDEN'))).toBe(false);
  });

  it('retries a rate limit, a server error and a network failure three times', () => {
    for (const failure of [
      error('TOO_MANY_REQUESTS'),
      error('INTERNAL_SERVER_ERROR'),
      new TypeError('fetch failed'),
    ]) {
      expect(shouldRetry(2, failure)).toBe(true);
      expect(shouldRetry(3, failure)).toBe(false);
    }
  });

  it('waits for the rate-limit window to slide before retrying', () => {
    const limited = error('TOO_MANY_REQUESTS');
    expect([0, 1, 2].map((attempt) => retryDelay(attempt, limited))).toEqual([
      15_000, 30_000, 60_000,
    ]);
    expect(retryDelay(0, new TypeError('fetch failed'))).toBe(1000);
  });
});
