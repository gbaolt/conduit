import type { Room } from '@conduit/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeedRepository } from '@/feed/domain/feed.repository';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';

import { InMemoryActivityRepository } from '../testing/in-memory-activity.repository';
import { ActivityService, type ActivityViewer } from './activity.service';

const viewer: ActivityViewer = {
  userId: 'u1',
  organizationId: 'org',
  workspaceRole: 'member',
};

function setup(channel: Partial<Room> | null = {}) {
  const repository = new InMemoryActivityRepository(
    new Map([
      ['m1', { roomId: 'c1', createdAt: new Date('2026-11-07T10:00:00Z') }],
      ['m2', { roomId: 'c1', createdAt: new Date('2026-11-07T10:05:00Z') }],
      ['other', { roomId: 'c2', createdAt: new Date('2026-11-07T10:09:00Z') }],
    ])
  );
  const channels = {
    find: async () =>
      channel && {
        visibility: 'public',
        isDefault: false,
        archivedAt: null,
        membership: {
          role: 'member',
          starredAt: null,
          sectionId: null,
          notify: null,
          mutedAt: null,
        },
        ...channel,
      },
  } as Partial<RoomsRepository> as RoomsRepository;
  const feedReads: { roomId: string; userId: string }[] = [];
  const feed = {
    markReadThroughPosition: async (input) => {
      feedReads.push(input);
    },
  } as Partial<FeedRepository> as FeedRepository;
  return {
    service: new ActivityService(repository, channels, feed),
    repository,
    feedReads,
  };
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

      await service.markRead(viewer, { roomId: 'c1', messageId: 'm2' });

      expect(repository.reads.get('c1|u1')?.messageId).toBe('m2');
    });

    it("marks the viewer's mention items in the room read once the position moves", async () => {
      const { service, feedReads } = setup();

      await service.markRead(viewer, { roomId: 'c1', messageId: 'm2' });

      expect(feedReads).toEqual([{ roomId: 'c1', userId: 'u1' }]);
    });

    it('leaves the mention items alone when the message is refused', async () => {
      const { service, feedReads } = setup();

      await expect(
        service.markRead(viewer, { roomId: 'c1', messageId: 'other' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(feedReads).toEqual([]);
    });

    it('never moves the position backward', async () => {
      const { service, repository } = setup();

      await service.markRead(viewer, { roomId: 'c1', messageId: 'm2' });
      await service.markRead(viewer, { roomId: 'c1', messageId: 'm1' });

      expect(repository.reads.get('c1|u1')?.messageId).toBe('m2');
    });

    it('refuses a message from another channel', async () => {
      const { service } = setup();

      await expect(
        service.markRead(viewer, { roomId: 'c1', messageId: 'other' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('refuses a private channel the viewer is not in', async () => {
      const { service } = setup({ visibility: 'private', membership: null });

      await expect(
        service.markRead(viewer, { roomId: 'c1', messageId: 'm1' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('drafts', () => {
    it('keeps a thread draft apart from the channel draft', async () => {
      const { service } = setup();

      await service.saveDraft(viewer, { roomId: 'c1' }, 'channel text');
      await service.saveDraft(
        viewer,
        { roomId: 'c1', parentId: 'root' },
        'thread text'
      );

      await expect(service.getDraft(viewer, { roomId: 'c1' })).resolves.toEqual(
        { body: 'channel text' }
      );
      await expect(
        service.getDraft(viewer, { roomId: 'c1', parentId: 'root' })
      ).resolves.toEqual({ body: 'thread text' });
    });

    it('deletes the draft when the body is empty', async () => {
      const { service } = setup();

      await service.saveDraft(viewer, { roomId: 'c1' }, 'text');
      await service.saveDraft(viewer, { roomId: 'c1' }, '');

      await expect(service.getDraft(viewer, { roomId: 'c1' })).resolves.toEqual(
        { body: '' }
      );
    });

    it('refuses a draft in an archived channel', async () => {
      const { service } = setup({ archivedAt: new Date() });

      await expect(
        service.saveDraft(viewer, { roomId: 'c1' }, 'text')
      ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });
    });
  });

  describe('typing and presence', () => {
    it('keeps the member typing for 5 s after a ping', async () => {
      const { service, repository } = setup();

      await service.ping(viewer, { roomId: 'c1' });

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
