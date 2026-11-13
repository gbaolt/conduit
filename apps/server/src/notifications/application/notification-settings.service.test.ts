import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { NotificationSettingsRepository } from '@/notifications/domain/notification-settings.repository';

import { NotificationSettingsService } from './notification-settings.service';

const repository = (): NotificationSettingsRepository => {
  const rows = new Map<string, NotificationSettings>();
  const key = (scope: { organizationId: string; userId: string }) =>
    `${scope.organizationId}:${scope.userId}`;
  return {
    get: (scope) =>
      Promise.resolve(rows.get(key(scope)) ?? DEFAULT_NOTIFICATION_SETTINGS),
    update: (scope, patch) => {
      const next = {
        ...(rows.get(key(scope)) ?? DEFAULT_NOTIFICATION_SETTINGS),
        ...patch,
      };
      rows.set(key(scope), next);
      return Promise.resolve(next);
    },
  };
};

const viewer = (userId: string, organizationId = 'org') => ({
  userId,
  organizationId,
  workspaceRole: 'member' as const,
});

describe('NotificationSettingsService', () => {
  it('gives a member with no row the defaults', async () => {
    const service = new NotificationSettingsService(repository());

    await expect(service.get(viewer('a'))).resolves.toEqual(
      DEFAULT_NOTIFICATION_SETTINGS
    );
  });

  it('keeps a field the patch leaves out', async () => {
    const service = new NotificationSettingsService(repository());

    await service.update(viewer('a'), { timeZone: 'Asia/Ho_Chi_Minh' });
    const updated = await service.update(viewer('a'), { emailDigest: false });

    expect(updated).toEqual({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      timeZone: 'Asia/Ho_Chi_Minh',
      emailDigest: false,
    });
  });

  it('scopes settings to the member and the workspace', async () => {
    const service = new NotificationSettingsService(repository());
    const until = new Date('2026-11-13T13:00:00Z');

    await service.update(viewer('a'), { dndUntil: until });

    await expect(service.get(viewer('a'))).resolves.toMatchObject({
      dndUntil: until,
    });
    await expect(service.get(viewer('b'))).resolves.toEqual(
      DEFAULT_NOTIFICATION_SETTINGS
    );
    await expect(service.get(viewer('a', 'other'))).resolves.toEqual(
      DEFAULT_NOTIFICATION_SETTINGS
    );
  });
});
