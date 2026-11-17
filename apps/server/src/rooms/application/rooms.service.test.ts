import type { Room } from '@conduit/contract';
import { describe, expect, it, vi } from 'vitest';

import type {
  MembershipPatch,
  RoomsRepository,
} from '@/rooms/domain/rooms.repository';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

import { RoomsService, type RoomViewer } from './rooms.service';

const viewer: RoomViewer = {
  userId: 'u1',
  organizationId: 'org',
  workspaceRole: 'member',
};

const room = (
  membership: Room['membership'],
  overrides: Partial<Room> = {}
): Room => ({
  id: 'r1',
  organizationId: 'org',
  kind: 'channel',
  name: 'design',
  topic: null,
  description: null,
  visibility: 'public',
  permissions: {
    post: 'everyone',
    reply: 'everyone',
    mentionEveryone: 'everyone',
  },
  isDefault: false,
  archivedAt: null,
  memberCount: 2,
  createdById: null,
  createdAt: new Date(0),
  membership,
  archivedByName: null,
  ...overrides,
});

const joined: Room['membership'] = {
  role: 'member',
  starredAt: null,
  sectionId: null,
  notify: null,
  mutedAt: null,
  closedAt: null,
};

function setup(found: Room | null) {
  const updates: { roomId: string; userId: string; patch: MembershipPatch }[] =
    [];
  const rooms = {
    find: () => Promise.resolve(found),
    updateMembership: (
      roomId: string,
      userId: string,
      patch: MembershipPatch
    ) => {
      updates.push({ roomId, userId, patch });
      return Promise.resolve();
    },
  } as unknown as RoomsRepository;
  const service = new RoomsService(
    rooms,
    {} as unknown as WorkspaceMembersRepository
  );
  return { service, updates };
}

describe('RoomsService star', () => {
  it('stars with a timestamp and unstars with null', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const { service, updates } = setup(room(joined));

    await service.star(viewer, 'r1');
    await service.unstar(viewer, 'r1');
    vi.useRealTimers();

    expect(updates.map(({ patch }) => patch)).toEqual([
      { starredAt: new Date('2026-11-13T12:00:00Z') },
      { starredAt: null },
    ]);
  });

  it('lets a member star and unstar a DM', async () => {
    const { service, updates } = setup(
      room(joined, { kind: 'dm', visibility: 'private' })
    );

    await service.star(viewer, 'r1');
    await service.unstar(viewer, 'r1');

    expect(updates).toHaveLength(2);
  });

  it('lets a member star an archived channel', async () => {
    const { service, updates } = setup(
      room(joined, { archivedAt: new Date(0) })
    );

    await service.star(viewer, 'r1');

    expect(updates).toHaveLength(1);
  });

  it('refuses a viewer who can see the room but is not in it', async () => {
    const { service, updates } = setup(room(null));

    await expect(service.star(viewer, 'r1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.unstar(viewer, 'r1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(updates).toEqual([]);
  });

  it('refuses a DM the viewer is not in as missing', async () => {
    const { service, updates } = setup(
      room(null, { kind: 'dm', visibility: 'private' })
    );

    await expect(service.star(viewer, 'r1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(updates).toEqual([]);
  });
});

describe('RoomsService notification preferences', () => {
  it('stores a level for the member, and null to go back to the default', async () => {
    const { service, updates } = setup(room(joined));

    await service.setNotify(viewer, 'r1', 'nothing');
    await service.setNotify(viewer, 'r1', null);

    expect(updates).toEqual([
      { roomId: 'r1', userId: 'u1', patch: { notify: 'nothing' } },
      { roomId: 'r1', userId: 'u1', patch: { notify: null } },
    ]);
  });

  it('mutes with a timestamp and unmutes with null', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-13T12:00:00Z'));
    const { service, updates } = setup(room(joined));

    await service.mute(viewer, 'r1');
    await service.unmute(viewer, 'r1');
    vi.useRealTimers();

    expect(updates.map(({ patch }) => patch)).toEqual([
      { mutedAt: new Date('2026-11-13T12:00:00Z') },
      { mutedAt: null },
    ]);
  });

  it('refuses a viewer who can see the channel but is not in it', async () => {
    const { service, updates } = setup(room(null));

    await expect(service.setNotify(viewer, 'r1', 'all')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.mute(viewer, 'r1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(updates).toEqual([]);
  });

  it('refuses a room that does not exist in the workspace', async () => {
    const { service } = setup(null);

    await expect(service.unmute(viewer, 'r1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
