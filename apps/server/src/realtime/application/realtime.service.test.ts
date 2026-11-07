import type { Channel } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { ChannelsRepository } from '@/channels/domain/channels.repository';
import type {
  LiveQueries,
  LiveQuery,
} from '@/realtime/domain/live-queries.port';

import { RealtimeService, type RealtimeViewer } from './realtime.service';

const viewer: RealtimeViewer = {
  userId: 'u1',
  organizationId: 'org',
  workspaceRole: 'member',
};
const since = new Date('2026-11-07T00:00:00.000Z');
const stream = { kind: 'conversation', channelId: 'c1', since } as const;

function setup(channel: Partial<Channel> | null) {
  const sealed: LiveQuery[] = [];
  const liveQueries: LiveQueries = {
    seal: async (query) => {
      sealed.push(query);
      return {
        capability: 'cap',
        queryFingerprint: 'fp',
        expiresAt: 1,
        url: 'wss://live',
      };
    },
  };
  const channels = {
    find: async () =>
      channel && {
        visibility: 'public',
        isDefault: false,
        archivedAt: null,
        membership: null,
        ...channel,
      },
  } as Partial<ChannelsRepository> as ChannelsRepository;
  return { service: new RealtimeService(liveQueries, channels), sealed };
}

describe('RealtimeService.seal', () => {
  it('seals the conversation query for a channel the viewer can read', async () => {
    const { service, sealed } = setup({});

    await expect(service.seal(viewer, stream)).resolves.toMatchObject({
      capability: 'cap',
    });
    expect(sealed).toHaveLength(1);
    expect(sealed[0]?.parameters).toEqual(['c1', since]);
    expect(sealed[0]?.sql).toContain('FROM "Message" WHERE "channelId" = $1');
  });

  it('seals the thread query for the root and its replies', async () => {
    const { service, sealed } = setup({});

    await service.seal(viewer, {
      kind: 'thread',
      channelId: 'c1',
      parentId: 'm1',
      since,
    });

    expect(sealed[0]?.parameters).toEqual(['c1', 'm1', since]);
    expect(sealed[0]?.sql).toContain('"parentId" = $2 OR "id" = $2');
  });

  it('refuses a thread of a private channel the viewer is not in', async () => {
    const { service, sealed } = setup({ visibility: 'private' });

    await expect(
      service.seal(viewer, {
        kind: 'thread',
        channelId: 'c1',
        parentId: 'm1',
        since,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(sealed).toEqual([]);
  });

  it('refuses a private channel the viewer is not in', async () => {
    const { service, sealed } = setup({ visibility: 'private' });

    await expect(service.seal(viewer, stream)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(sealed).toEqual([]);
  });

  it('refuses a channel that does not exist', async () => {
    const { service } = setup(null);

    await expect(service.seal(viewer, stream)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
