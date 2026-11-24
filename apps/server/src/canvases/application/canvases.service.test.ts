import type { CanvasRole, Room } from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type {
  CanvasesRepository,
  StoredCanvasDocument,
} from '@/canvases/domain/canvases.repository';
import { PrismaCanvasesRepository } from '@/canvases/infrastructure/prisma-canvases.repository';
import { prisma } from '@/infrastructure/database/prisma.service';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';
import { PrismaRoomsRepository } from '@/rooms/infrastructure/prisma-rooms.repository';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { CanvasesService, type CanvasViewerScope } from './canvases.service';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const organizationId = 'org';
const viewerOf = (
  userId: string,
  workspaceRole: CanvasViewerScope['workspaceRole'] = 'member'
): CanvasViewerScope => ({ userId, organizationId, workspaceRole });
const alice = viewerOf('alice');
const bob = viewerOf('bob');
const carol = viewerOf('carol');

function roomFor(overrides: Partial<Room> = {}): Room {
  return {
    id: 'general',
    organizationId,
    kind: 'channel',
    name: 'general',
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
    memberCount: 1,
    createdById: null,
    createdAt: new Date(0),
    membership: {
      role: 'member',
      starredAt: null,
      sectionId: null,
      notify: null,
      mutedAt: null,
      closedAt: null,
    },
    archivedByName: null,
    ...overrides,
  };
}

/** An in-memory port. `members` of a room are who `rooms.find` treats as in it. */
function setup(room: Room = roomFor(), roomMembers = ['alice', 'bob']) {
  const canvases = new Map<
    string,
    Omit<StoredCanvasDocument, 'viewerRole'> & { deletedAt: Date | null }
  >();
  const shares = new Map<string, Map<string, CanvasRole>>();
  let next = 0;
  const guard = (canvasId: string, write: () => void) => {
    const before = new Map(shares.get(canvasId));
    write();
    if (![...shares.get(canvasId)!.values()].includes('editor')) {
      shares.set(canvasId, before);
      throw Object.assign(new Error('LAST_EDITOR'), { code: 'LAST_EDITOR' });
    }
  };
  const view = (userId: string, id: string) => {
    const row = canvases.get(id);
    return row && !row.deletedAt
      ? { ...row, viewerRole: shares.get(id)?.get(userId) ?? null }
      : null;
  };
  const insert = (roomId: string | null, title: string, userId: string) => {
    const id = `canvas-${++next}`;
    canvases.set(id, {
      id,
      organizationId,
      roomId,
      roomName: roomId && room.name,
      isChannelPrimary: roomId !== null,
      title,
      createdById: userId,
      updatedByName: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      snapshotJson: null,
      markdown: '',
      deletedAt: null,
    });
    shares.set(id, new Map(roomId ? [] : [[userId, 'editor']]));
    return id;
  };
  const repository = {
    find: async (scope, id) => view(scope.userId, id),
    findChannelPrimary: async (scope, roomId) => {
      const row = [...canvases.values()].find(
        (c) => c.roomId === roomId && c.isChannelPrimary && !c.deletedAt
      );
      return row ? view(scope.userId, row.id) : null;
    },
    createChannelPrimary: async (scope, roomId, title) =>
      insert(roomId, title, scope.userId),
    createStandalone: async (scope, title) => insert(null, title, scope.userId),
    list: async (scope, roomIds) =>
      [...canvases.keys()]
        .map((id) => view(scope.userId, id))
        .filter(
          (c) =>
            c !== null &&
            (c.roomId ? roomIds.includes(c.roomId) : c.viewerRole !== null)
        ) as StoredCanvasDocument[],
    update: async (_scope, id, patch) => {
      canvases.set(id, { ...canvases.get(id)!, ...patch });
    },
    softDelete: async (id) => {
      canvases.set(id, { ...canvases.get(id)!, deletedAt: new Date() });
    },
    listMembers: async (_scope, id) =>
      [...shares.get(id)!].map(([userId, role]) => ({
        userId,
        name: userId,
        email: `${userId}@test.local`,
        image: null,
        role,
        addedAt: new Date(0),
      })),
    share: async (_scope, id, userIds, role) =>
      guard(id, () => {
        for (const userId of userIds) shares.get(id)!.set(userId, role);
      }),
    setMemberRole: async (_scope, id, userId, role) =>
      guard(id, () => {
        if (shares.get(id)!.has(userId)) shares.get(id)!.set(userId, role);
      }),
    removeMember: async (_scope, id, userId) =>
      guard(id, () => shares.get(id)!.delete(userId)),
  } satisfies CanvasesRepository;
  const asSeenBy = (userId: string): Room => ({
    ...room,
    membership: roomMembers.includes(userId) ? room.membership : null,
  });
  const rooms = {
    find: async (scope: { userId: string }, id: string) =>
      id === room.id ? asSeenBy(scope.userId) : null,
    list: async (scope: { userId: string }, archived: boolean) => {
      const seen = asSeenBy(scope.userId);
      const visible = seen.visibility === 'public' || seen.membership !== null;
      return visible && Boolean(seen.archivedAt) === archived ? [seen] : [];
    },
  } as Partial<RoomsRepository> as RoomsRepository;
  const workspaceMembers = {
    count: async (_org: string, userIds: string[]) =>
      userIds.filter((id) => ['alice', 'bob', 'carol'].includes(id)).length,
  } as Partial<WorkspaceMembersRepository> as WorkspaceMembersRepository;
  return {
    service: new CanvasesService(repository, rooms, workspaceMembers),
    canvases,
  };
}

describe('CanvasesService', () => {
  it('creates one primary canvas per channel and reopens it on a second create', async () => {
    const { service } = setup();
    expect(await service.getChannelCanvas(alice, 'general')).toBeNull();

    const first = await service.create(alice, { roomId: 'general' });
    const second = await service.create(bob, { roomId: 'general' });

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ title: 'general', roomName: 'general' });
    expect((await service.getChannelCanvas(bob, 'general'))?.id).toBe(first.id);
  });

  it('hides a private channel canvas from people outside the channel', async () => {
    const { service } = setup(roomFor({ visibility: 'private' }), ['alice']);
    const canvas = await service.create(alice, { roomId: 'general' });

    await expect(service.get(carol, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      service.getChannelCanvas(carol, 'general')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.update(carol, { canvasId: canvas.id, markdown: 'x' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await service.list(carol, 'all')).toEqual([]);
  });

  it('leaves an archived channel canvas readable but refuses edits', async () => {
    const room = roomFor();
    const { service } = setup(room);
    const canvas = await service.create(alice, { roomId: 'general' });
    room.archivedAt = new Date();

    expect((await service.get(alice, canvas.id)).access).toEqual({
      edit: false,
      manageSharing: false,
      delete: false,
    });
    await expect(
      service.update(alice, { canvasId: canvas.id, markdown: 'x' })
    ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });
    expect(await service.list(alice, 'all')).toHaveLength(1);
  });

  it('refuses a channel canvas in an archived channel before it exists', async () => {
    const { service } = setup(roomFor({ archivedAt: new Date() }));
    await expect(
      service.create(alice, { roomId: 'general' })
    ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });
  });

  it('shares a standalone canvas, then changes and removes roles', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, { title: 'Plan' });
    await expect(service.get(bob, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    await service.share(alice, {
      canvasId: canvas.id,
      userIds: ['bob'],
      role: 'viewer',
    });
    expect((await service.get(bob, canvas.id)).access.edit).toBe(false);
    await expect(
      service.update(bob, { canvasId: canvas.id, markdown: 'x' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.share(bob, {
        canvasId: canvas.id,
        userIds: ['carol'],
        role: 'viewer',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.get(carol, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    await service.updateMemberRole(alice, {
      canvasId: canvas.id,
      userId: 'bob',
      role: 'editor',
    });
    await service.update(bob, { canvasId: canvas.id, markdown: '# Plan' });
    expect(
      (await service.listMembers(alice, canvas.id)).map((m) => m.role)
    ).toEqual(['editor', 'editor']);

    await service.removeMember(alice, { canvasId: canvas.id, userId: 'bob' });
    await expect(service.get(bob, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses to share with someone outside the workspace', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {});
    await expect(
      service.share(alice, {
        canvasId: canvas.id,
        userIds: ['stranger'],
        role: 'viewer',
      })
    ).rejects.toMatchObject({ code: 'NOT_A_MEMBER' });
  });

  it('keeps the last editor', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {});
    await expect(
      service.updateMemberRole(alice, {
        canvasId: canvas.id,
        userId: 'alice',
        role: 'viewer',
      })
    ).rejects.toMatchObject({ code: 'LAST_EDITOR' });
    await expect(
      service.removeMember(alice, { canvasId: canvas.id, userId: 'alice' })
    ).rejects.toMatchObject({ code: 'LAST_EDITOR' });
  });

  it('frees the channel for a new primary canvas once its canvas is deleted', async () => {
    const { service } = setup();
    const first = await service.create(alice, { roomId: 'general' });
    await expect(service.delete(bob, first.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    await service.delete(alice, first.id);

    await expect(service.get(alice, first.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await service.getChannelCanvas(alice, 'general')).toBeNull();
    expect((await service.create(bob, { roomId: 'general' })).id).not.toBe(
      first.id
    );
  });
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('CanvasesService with Postgres', () => {
  const service = new CanvasesService(
    new PrismaCanvasesRepository(prisma),
    new PrismaRoomsRepository(prisma),
    new PrismaWorkspaceMembersRepository(prisma)
  );
  const run = crypto.randomUUID();
  const users = { owner: `${run}-owner`, member: `${run}-member` };
  const scope = (userId: string): CanvasViewerScope => ({
    userId,
    organizationId: run,
    workspaceRole: 'member',
  });
  const owner = scope(users.owner);
  const member = scope(users.member);
  const roomId = `${run}-room`;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: Object.values(users).map((id) => ({
        id,
        name: id,
        email: `${id}@test.local`,
      })),
    });
    await prisma.organization.create({
      data: {
        id: run,
        name: 'Acme',
        slug: `acme-${run}`,
        createdAt: new Date(),
      },
    });
    await prisma.member.createMany({
      data: Object.values(users).map((userId) => ({
        userId,
        organizationId: run,
        role: 'member',
        createdAt: new Date(),
      })),
    });
    await prisma.room.create({
      data: {
        id: roomId,
        organizationId: run,
        name: 'design',
        members: {
          create: Object.values(users).map((userId) => ({ userId })),
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: run } });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it('lets two people racing to create a channel canvas open the same one', async () => {
    const [a, b] = await Promise.all([
      service.create(owner, { roomId }),
      service.create(member, { roomId }),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      await prisma.canvas.count({ where: { roomId, isChannelPrimary: true } })
    ).toBe(1);
  });

  it('keeps the last editor when two editors demote each other at once', async () => {
    const canvas = await service.create(owner, {});
    await service.share(owner, {
      canvasId: canvas.id,
      userIds: [users.member],
      role: 'editor',
    });

    const results = await Promise.allSettled([
      service.updateMemberRole(owner, {
        canvasId: canvas.id,
        userId: users.member,
        role: 'viewer',
      }),
      service.updateMemberRole(member, {
        canvasId: canvas.id,
        userId: users.owner,
        role: 'viewer',
      }),
    ]);

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.canvasMember.count({
        where: { canvasId: canvas.id, role: 'EDITOR' },
      })
    ).toBe(1);
  });

  it('removes canvases and their shares with their channel', async () => {
    const canvas = await service.create(owner, { roomId });
    await prisma.room.delete({ where: { id: roomId } });
    expect(
      await prisma.canvas.findUnique({ where: { id: canvas.id } })
    ).toBeNull();
  });
});
