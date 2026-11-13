import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DigestsService } from '@/notifications/application/digests.service';

import { DigestsController } from './digests.controller';

describe('DigestsController', () => {
  const sendDigests = vi.fn(() => Promise.resolve(3));
  const controller = new DigestsController({
    sendDigests,
  } as unknown as DigestsService);

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'correct-secret');
    sendDigests.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('runs the digests and returns the count for the right secret', async () => {
    await expect(controller.run('Bearer correct-secret')).resolves.toEqual({
      sent: 3,
    });
    expect(sendDigests).toHaveBeenCalledOnce();
  });

  it.each([
    ['a missing header', undefined],
    ['a wrong secret', 'Bearer wrong-secret'],
    ['a secret of another length', 'Bearer correct-secret-and-more'],
    ['no Bearer scheme', 'correct-secret'],
    ['an empty secret', 'Bearer '],
  ])('refuses %s', async (_, header) => {
    await expect(controller.run(header)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(sendDigests).not.toHaveBeenCalled();
  });

  it('refuses everything while CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', '');

    await expect(controller.run('Bearer ')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
