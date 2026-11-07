import { DEFAULT_WORKSPACE_SETTINGS } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { WorkspaceSettingsRepository } from '@/workspaces/domain/workspace-settings.repository';

import { WorkspaceSettingsService } from './workspace-settings.service';

const repository = (): WorkspaceSettingsRepository => {
  let stored = DEFAULT_WORKSPACE_SETTINGS;
  return {
    get: () => Promise.resolve(stored),
    update: (_id, input) => Promise.resolve((stored = { ...stored, ...input })),
  };
};

const viewer = (workspaceRole: 'owner' | 'admin' | 'member') => ({
  userId: 'u',
  organizationId: 'o',
  workspaceRole,
});

describe('WorkspaceSettingsService', () => {
  it('lets an admin change one setting and keeps the other', async () => {
    const service = new WorkspaceSettingsService(repository());

    expect(
      await service.update(viewer('admin'), { publicChannelCreators: 'admins' })
    ).toEqual({ channelCreators: 'everyone', publicChannelCreators: 'admins' });
  });

  it('refuses a member', () => {
    const service = new WorkspaceSettingsService(repository());

    expect(() =>
      service.update(viewer('member'), { channelCreators: 'admins' })
    ).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
