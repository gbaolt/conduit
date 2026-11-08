import { DEFAULT_AI_SETTINGS } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { AiSettingsRepository } from '@/ai/domain/ai-settings.repository';

import { AiAccessService } from './ai-access.service';

const repository = (): AiSettingsRepository => {
  let stored = DEFAULT_AI_SETTINGS;
  return {
    get: () => Promise.resolve(stored),
    set: (_id, settings) => Promise.resolve((stored = settings)),
  };
};

const viewer = (workspaceRole: 'owner' | 'admin' | 'member') => ({
  userId: 'u',
  organizationId: 'o',
  workspaceRole,
});

describe('AiAccessService', () => {
  it('lets a workspace with no settings use AI', async () => {
    const access = new AiAccessService(repository());

    await expect(access.assertEnabled('o')).resolves.toBeUndefined();
  });

  it('refuses with AI_DISABLED once an admin turns AI off, and lets it back on', async () => {
    const access = new AiAccessService(repository());

    await access.update(viewer('admin'), { aiEnabled: false });
    await expect(access.assertEnabled('o')).rejects.toMatchObject({
      code: 'AI_DISABLED',
    });

    await access.update(viewer('owner'), { aiEnabled: true });
    await expect(access.assertEnabled('o')).resolves.toBeUndefined();
  });

  it('refuses a member who tries to change it', () => {
    const access = new AiAccessService(repository());

    expect(() => access.update(viewer('member'), { aiEnabled: false })).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' })
    );
  });
});
