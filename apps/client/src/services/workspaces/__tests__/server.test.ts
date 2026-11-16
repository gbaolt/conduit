import { ORPCError } from '@orpc/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchQuery = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/query/hydration', () => ({
  getQueryClient: () => ({ fetchQuery }),
}));

const { requireWorkspaces } = await import('../server');

describe('requireWorkspaces', () => {
  beforeEach(() => {
    fetchQuery.mockReset();
  });

  it('lets the shell render when the workspaces fail to load', async () => {
    fetchQuery.mockRejectedValue(new ORPCError('TOO_MANY_REQUESTS'));
    await expect(requireWorkspaces()).resolves.toBeUndefined();
  });

  it('sends a user with no workspaces to onboarding', async () => {
    fetchQuery.mockResolvedValue([]);
    await expect(requireWorkspaces()).rejects.toMatchObject({
      digest: expect.stringContaining('/onboarding'),
    });
  });
});
