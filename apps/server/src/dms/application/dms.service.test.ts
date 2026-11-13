import type { Dm, Room } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { DmsRepository } from '@/dms/domain/dms.repository';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

import { DmsService, type DmViewer } from './dms.service';

const organizationId = 'org';
const viewerOf = (
  userId: string,
  workspaceRole: DmViewer['workspaceRole'] = 'member'
): DmViewer => ({ userId, organizationId, workspaceRole });

const linh = viewerOf('linh');
const bao = viewerOf('bao');
const admin = viewerOf('admin', 'admin');
const outsider = viewerOf('outsider');

function channelFor(member: boolean, overrides: Partial<Room> = {}): Room {
  return {
    id: 'dm1',
    organizationId,
    kind: 'dm',
    name: '',
    topic: null,
    description: null,
    visibility: 'private',
    isDefault: false,
    archivedAt: null,
    memberCount: 2,
    createdById: null,
    createdAt: new Date(0),
    membership: member
      ? {
          role: 'member',
          starredAt: null,
          sectionId: null,
          notify: null,
          mutedAt: null,
        }
      : null,
    archivedByName: null,
    ...overrides,
  };
}

const dmOf = (...userIds: string[]): Dm => ({
  id: 'dm1',
  members: userIds.map((userId) => ({ userId, name: userId, image: null })),
  lastMessageAt: null,
  createdAt: new Date(0),
});

function setup(
  views: Record<string, Room | null>,
  workspaceUsers = ['linh', 'bao', 'cy', 'admin', 'outsider']
) {
  const calls = {
    open: [] as string[][],
    addPeople: [] as string[][],
    convert: [] as string[],
  };
  const dms = {
    list: async () => [dmOf('linh', 'bao')],
    open: async (_scope, userIds) => {
      calls.open.push(userIds);
      return dmOf(...userIds);
    },
    addPeople: async (_scope, _channelId, userIds) => {
      calls.addPeople.push(userIds);
      return dmOf('linh', 'bao', ...userIds);
    },
    convertToChannel: async (_scope, _channelId, name) => {
      calls.convert.push(name);
      return channelFor(true, { kind: 'channel', name });
    },
  } as Partial<DmsRepository> as DmsRepository;
  const channels = {
    find: async (scope: { userId: string }) => views[scope.userId] ?? null,
  } as Partial<RoomsRepository> as RoomsRepository;
  const workspaceMembers = {
    count: async (_org: string, userIds: string[]) =>
      userIds.filter((id) => workspaceUsers.includes(id)).length,
  } as Partial<WorkspaceMembersRepository> as WorkspaceMembersRepository;

  return { service: new DmsService(dms, channels, workspaceMembers), calls };
}

describe('DmsService.open', () => {
  it('adds the viewer to the people they open a DM with', async () => {
    const { service, calls } = setup({});

    await service.open(linh, ['bao']);

    expect(calls.open).toEqual([['linh', 'bao']]);
  });

  it('opens the self DM with no people, and counts the viewer once', async () => {
    const { service, calls } = setup({});

    await service.open(linh, []);
    await service.open(linh, ['linh', 'linh']);

    expect(calls.open).toEqual([['linh'], ['linh']]);
  });

  it('accepts ten people with the viewer and refuses an eleventh', async () => {
    const everyone = Array.from({ length: 12 }, (_, i) => `u${i}`);
    const { service, calls } = setup({}, [...everyone, 'linh']);

    await service.open(linh, everyone.slice(0, 9));
    expect(calls.open[0]).toHaveLength(10);

    await expect(
      service.open(linh, everyone.slice(0, 10))
    ).rejects.toMatchObject({ code: 'DM_FULL' });
  });

  it('refuses someone who is not in the workspace', async () => {
    const { service, calls } = setup({});

    await expect(service.open(linh, ['stranger'])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(calls.open).toEqual([]);
  });
});

describe('DmsService.addPeople and convertToChannel', () => {
  const views = { linh: channelFor(true), bao: channelFor(true) };

  it('lets a member add people who are in the workspace', async () => {
    const { service, calls } = setup(views);

    await service.addPeople(linh, 'dm1', ['cy', 'cy']);

    expect(calls.addPeople).toEqual([['cy']]);
  });

  it('refuses to add someone from outside the workspace', async () => {
    const { service } = setup(views);

    await expect(
      service.addPeople(linh, 'dm1', ['stranger'])
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('converts for a member', async () => {
    const { service, calls } = setup(views);

    const channel = await service.convertToChannel(bao, 'dm1', 'planning');

    expect(calls.convert).toEqual(['planning']);
    expect(channel).toMatchObject({ kind: 'channel', name: 'planning' });
  });

  it.each([
    ['a workspace admin outside the DM', admin, channelFor(false)],
    ['a member outside the DM', outsider, channelFor(false)],
  ])('hides the DM from %s', async (_label, viewer, view) => {
    const { service, calls } = setup({ ...views, [viewer.userId]: view });

    await expect(
      service.addPeople(viewer, 'dm1', ['cy'])
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.convertToChannel(viewer, 'dm1', 'planning')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(calls.addPeople).toEqual([]);
    expect(calls.convert).toEqual([]);
  });

  it('treats a missing conversation and a regular channel alike', async () => {
    const { service } = setup({
      ...views,
      admin: channelFor(true, { kind: 'channel', visibility: 'public' }),
    });

    await expect(
      service.addPeople(outsider, 'ghost', ['cy'])
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.convertToChannel(admin, 'dm1', 'planning')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('DmsService.list', () => {
  it('returns the viewer’s DMs', async () => {
    const { service } = setup({});

    await expect(service.list(linh)).resolves.toHaveLength(1);
  });
});
