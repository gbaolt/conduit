import type { Channel } from '@conduit/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelsRepository } from '@/channels/domain/channels.repository';

import { InMemoryActivityRepository } from '../testing/in-memory-activity.repository';
import { ActivityService, type ActivityViewer } from './activity.service';

const viewer: ActivityViewer = {
  userId: 'u1',
  organizationId: 'org',
  workspaceRole: 'member',
};

function setup(channel: Partial<Channel> | null = {}) {
  const repository = new InMemoryActivityRepository(
    new Map([
      ['m1', { channelId: 'c1', createdAt: new Date('2026-11-07T10:00:00Z') }],
      ['m2', { channelId: 'c1', createdAt: new Date('2026-11-07T10:05:00Z') }],
      [
        'other',
        { channelId: 'c2', createdAt: new Date('2026-11-07T10:09:00Z') },
      ],
    ])
  );
  const channels = {
    find: async () =>
      channel && {
        visibility: 'public',
        isDefault: false,
        archivedAt: null,
        membership: { role: 'member', starredAt: null, sectionId: null },
        ...channel,
      },
  } as Partial<ChannelsRepository> as ChannelsRepository;
  return { service: new ActivityService(repository, channels), repository };
}

describe('ActivityService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  describe('markRead', () => {
    it('moves the read position to the message', async () => {
      const { service, repository } = setup();

      await service.markRead(viewer, { channelId: 'c1', messageId: 'm2' });

      expect(repository.reads.get('c1|u1')?.messageId).toBe('m2');
    });

    it('never moves the position backward', async () => {
      const { service, repository } = setup();

      await service.markRead(viewer, { channelId: 'c1', messageId: 'm2' });
      await service.markRead(viewer, { channelId: 'c1', messageId: 'm1' });

      expect(repository.reads.get('c1|u1')?.messageId).toBe('m2');
    });

    it('refuses a message from another channel', async () => {
      const { service } = setup();

      await expect(
        service.markRead(viewer, { channelId: 'c1', messageId: 'other' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('refuses a private channel the viewer is not in', async () => {
      const { service } = setup({ visibility: 'private', membership: null });

      await expect(
        service.markRead(viewer, { channelId: 'c1', messageId: 'm1' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('drafts', () => {
    it('keeps a thread draft apart from the channel draft', async () => {
      const { service } = setup();

      await service.saveDraft(viewer, { channelId: 'c1' }, 'channel text');
      await service.saveDraft(
        viewer,
        { channelId: 'c1', parentId: 'root' },
        'thread text'
      );

      await expect(
        service.getDraft(viewer, { channelId: 'c1' })
      ).resolves.toEqual({ body: 'channel text' });
      await expect(
        service.getDraft(viewer, { channelId: 'c1', parentId: 'root' })
      ).resolves.toEqual({ body: 'thread text' });
    });

    it('deletes the draft when the body is empty', async () => {
      const { service } = setup();

      await service.saveDraft(viewer, { channelId: 'c1' }, 'text');
      await service.saveDraft(viewer, { channelId: 'c1' }, '');

      await expect(
        service.getDraft(viewer, { channelId: 'c1' })
      ).resolves.toEqual({ body: '' });
    });

    it('refuses a draft in an archived channel', async () => {
      const { service } = setup({ archivedAt: new Date() });

      await expect(
        service.saveDraft(viewer, { channelId: 'c1' }, 'text')
      ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });
    });
  });

  describe('typing and presence', () => {
    it('keeps the member typing for 5 s after a ping', async () => {
      const { service, repository } = setup();

      await service.ping(viewer, { channelId: 'c1' });

      expect(repository.typing.get('c1|u1|')?.toISOString()).toBe(
        '2026-11-07T12:00:05.000Z'
      );
    });

    it('records a heartbeat for the workspace', async () => {
      const { service, repository } = setup();

      await service.heartbeat(viewer, true);

      expect(repository.presence.get('org|u1')).toEqual({
        at: new Date('2026-11-07T12:00:00Z'),
        away: true,
      });
    });
  });
});
