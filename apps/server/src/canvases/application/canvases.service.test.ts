import type { CanvasRole, Room } from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type {
  CanvasesRepository,
  StoredCanvasDocument,
  StoredEmbeddedMessage,
} from '@/canvases/domain/canvases.repository';
import { PrismaCanvasesRepository } from '@/canvases/infrastructure/prisma-canvases.repository';
import { FakeLiveblocksGateway } from '@/canvases/testing/fake-liveblocks.gateway';
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

/** A message in another room, which only `readers` may read. */
type EmbeddedFixture = StoredEmbeddedMessage & { readers: string[] };

function embeddedIn(
  roomId: string,
  kind: 'channel' | 'dm',
  readers: string[],
  deletedAt: Date | null = null
): EmbeddedFixture {
  return {
    readers,
    deletedAt,
    message: {
      id: `message-in-${roomId}`,
      parentId: null,
      body: `secret from ${roomId}`,
      room: { id: roomId, name: kind === 'dm' ? '' : roomId, kind },
      author: { id: 'alice', name: 'alice', image: null },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  };
}

/** An in-memory port. `members` of a room are who `rooms.find` treats as in it. */
function setup(
  room: Room = roomFor(),
  roomMembers = ['alice', 'bob'],
  liveblocks = new FakeLiveblocksGateway(),
  embedded: EmbeddedFixture[] = []
) {
  const canvases = new Map<
    string,
    Omit<StoredCanvasDocument, 'viewerRole'> & {
      deletedAt: Date | null;
      seededAt: Date | null;
      contentHash: string | null;
      initialMarkdown: string | null;
    }
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
      seededAt: null,
      contentHash: null,
      initialMarkdown: null,
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
    claimBootstrap: async (id) => {
      const row = canvases.get(id)!;
      if (row.seededAt) return null;
      row.seededAt = new Date();
      return {
        snapshotJson: row.snapshotJson && JSON.stringify(row.snapshotJson),
        initialMarkdown: row.initialMarkdown,
      };
    },
    saveSnapshot: async (_scope, id, snapshot) => {
      const row = canvases.get(id)!;
      const saved = row.contentHash !== snapshot.contentHash;
      if (saved) canvases.set(id, { ...row, ...snapshot });
      return { saved, updatedAt: row.updatedAt };
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
    findMessages: async (_org, ids) =>
      embedded.filter(({ message }) => ids.includes(message.id)),
  } satisfies CanvasesRepository;
  const asSeenBy = (userId: string): Room => ({
    ...room,
    membership: roomMembers.includes(userId) ? room.membership : null,
  });
  const visibleTo = (userId: string) => {
    const seen = asSeenBy(userId);
    return seen.visibility === 'public' || seen.membership !== null;
  };
  const rooms = {
    find: async (scope: { userId: string }, id: string) =>
      id === room.id ? asSeenBy(scope.userId) : null,
    list: async (scope: { userId: string }, archived: boolean) => {
      const seen = asSeenBy(scope.userId);
      return visibleTo(scope.userId) && Boolean(seen.archivedAt) === archived
        ? [seen]
        : [];
    },
    accessibleRoomIds: async (scope: { userId: string }) => [
      ...(visibleTo(scope.userId) ? [room.id] : []),
      ...embedded
        .filter(({ readers }) => readers.includes(scope.userId))
        .map(({ message }) => message.room.id),
    ],
  } as Partial<RoomsRepository> as RoomsRepository;
  const workspaceMembers = {
    count: async (_org: string, userIds: string[]) =>
      userIds.filter((id) => ['alice', 'bob', 'carol'].includes(id)).length,
  } as Partial<WorkspaceMembersRepository> as WorkspaceMembersRepository;
  return {
    service: new CanvasesService(
      repository,
      rooms,
      workspaceMembers,
      liveblocks
    ),
    canvases,
    liveblocks,
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
      comment: false,
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

  it('deletes the live room with the canvas', async () => {
    const { service, liveblocks } = setup();
    const canvas = await service.create(alice, { roomId: 'general' });
    await service.delete(alice, canvas.id);
    expect(liveblocks.deletedRooms).toEqual([`canvas:org:${canvas.id}`]);
  });

  it('deletes the canvas even when its live room cannot be removed', async () => {
    const liveblocks = new FakeLiveblocksGateway();
    liveblocks.deleteRoom = () => Promise.reject(new Error('down'));
    const { service } = setup(roomFor(), ['alice', 'bob'], liveblocks);
    const canvas = await service.create(alice, {});
    await service.delete(alice, canvas.id);
    await expect(service.get(alice, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('CanvasesService embedded messages', () => {
  const embeds = [
    embeddedIn('general-2', 'channel', ['alice', 'bob']),
    embeddedIn('private-ops', 'channel', ['alice']),
    embeddedIn('alice-bob-dm', 'dm', ['alice', 'bob']),
    embeddedIn('gone', 'channel', ['alice', 'bob'], new Date()),
  ];
  const [open, ops, dm, gone] = embeds.map(({ message }) => message.id) as [
    string,
    string,
    string,
    string,
  ];

  async function sharedCanvas() {
    const context = setup(roomFor(), ['alice', 'bob'], undefined, embeds);
    const canvas = await context.service.create(alice, {});
    await context.service.share(alice, {
      canvasId: canvas.id,
      userIds: ['bob', 'carol'],
      role: 'viewer',
    });
    return { ...context, canvas };
  }

  it('returns a message from a room the viewer reads, in the order asked', async () => {
    const { service, canvas } = await sharedCanvas();
    const results = await service.embeddedMessages(bob, {
      canvasId: canvas.id,
      messageIds: [dm, open],
    });
    expect(results.map((each) => each.status)).toEqual(['ok', 'ok']);
    expect(results[1]).toMatchObject({
      messageId: open,
      message: { body: 'secret from general-2' },
    });
  });

  it('returns a private channel message as inaccessible to someone outside it', async () => {
    const { service, canvas } = await sharedCanvas();
    expect(
      await service.embeddedMessages(bob, {
        canvasId: canvas.id,
        messageIds: [ops],
      })
    ).toEqual([{ messageId: ops, status: 'inaccessible' }]);
    expect(
      await service.embeddedMessages(alice, {
        canvasId: canvas.id,
        messageIds: [ops],
      })
    ).toMatchObject([{ status: 'ok' }]);
  });

  it('returns a DM message as inaccessible to a third person', async () => {
    const { service, canvas } = await sharedCanvas();
    expect(
      await service.embeddedMessages(carol, {
        canvasId: canvas.id,
        messageIds: [dm],
      })
    ).toEqual([{ messageId: dm, status: 'inaccessible' }]);
  });

  it('returns a deleted or unknown message as deleted', async () => {
    const { service, canvas } = await sharedCanvas();
    expect(
      await service.embeddedMessages(bob, {
        canvasId: canvas.id,
        messageIds: [gone, 'never-existed'],
      })
    ).toEqual([
      { messageId: gone, status: 'deleted' },
      { messageId: 'never-existed', status: 'deleted' },
    ]);
  });

  it('refuses someone who cannot open the canvas', async () => {
    const { service } = setup(roomFor(), ['alice', 'bob'], undefined, embeds);
    const canvas = await service.create(alice, {});
    await expect(
      service.embeddedMessages(bob, { canvasId: canvas.id, messageIds: [open] })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('CanvasesService live collaboration', () => {
  const user = { name: 'Alice', image: null };
  const write = ['room:write'];
  const read = ['room:read', 'room:presence:write'];
  const shareWithBob = async (
    service: CanvasesService,
    canvasId: string,
    role: CanvasRole
  ) => service.share(alice, { canvasId, userIds: ['bob'], role });

  it('grants an editor write access to the canvas room alone', async () => {
    const { service, liveblocks } = setup();
    const canvas = await service.create(alice, { roomId: 'general' });

    const auth = await service.liveblocksAuth(alice, canvas.id, user);

    const roomId = `canvas:org:${canvas.id}`;
    expect(auth).toEqual({
      enabled: true,
      token: 'token-1',
      roomId,
      color: expect.stringMatching(/^#[0-9a-f]{6}$/),
    });
    expect(liveblocks.grants).toEqual([
      {
        userId: 'alice',
        userInfo: { ...user, color: auth.enabled && auth.color },
        roomId,
        permissions: write,
      },
    ]);
  });

  it('gives a person the same cursor color on every canvas', async () => {
    const { service } = setup();
    const a = await service.create(alice, {});
    const b = await service.create(alice, {});
    const first = await service.liveblocksAuth(alice, a.id, user);
    const second = await service.liveblocksAuth(alice, b.id, user);
    expect(first.enabled && first.color).toBe(second.enabled && second.color);
  });

  it('grants a viewer read access and cursors only', async () => {
    const { service, liveblocks } = setup();
    const canvas = await service.create(alice, {});
    await shareWithBob(service, canvas.id, 'viewer');

    await service.liveblocksAuth(bob, canvas.id, user);

    expect(liveblocks.grants[0]?.permissions).toEqual(read);
  });

  it('leaves an archived channel canvas read-only in its room', async () => {
    const room = roomFor();
    const { service, liveblocks } = setup(room);
    const canvas = await service.create(alice, { roomId: 'general' });
    room.archivedAt = new Date();

    await service.liveblocksAuth(alice, canvas.id, user);

    expect(liveblocks.grants[0]?.permissions).toEqual(read);
  });

  it('refuses a token to anyone who cannot read the canvas', async () => {
    const { service, liveblocks } = setup(roomFor({ visibility: 'private' }), [
      'alice',
    ]);
    const channel = await service.create(alice, { roomId: 'general' });
    const standalone = await service.create(alice, {});

    for (const canvasId of [channel.id, standalone.id, 'missing']) {
      await expect(
        service.liveblocksAuth(carol, canvasId, user)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(liveblocks.grants).toEqual([]);
  });

  it('refuses a token once someone is removed from the canvas', async () => {
    const { service, liveblocks } = setup();
    const canvas = await service.create(alice, {});
    await shareWithBob(service, canvas.id, 'editor');
    await service.removeMember(alice, { canvasId: canvas.id, userId: 'bob' });

    await expect(
      service.liveblocksAuth(bob, canvas.id, user)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(liveblocks.grants).toEqual([]);
  });

  it('answers enabled: false without a Liveblocks key, after checking access', async () => {
    const { service } = setup(
      roomFor(),
      ['alice', 'bob'],
      new FakeLiveblocksGateway(false)
    );
    const canvas = await service.create(alice, {});

    expect(await service.liveblocksAuth(alice, canvas.id, user)).toEqual({
      enabled: false,
    });
    await expect(
      service.liveblocksAuth(carol, canvas.id, user)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets exactly one of several editors claim the first seed', async () => {
    const { service, canvases } = setup();
    const canvas = await service.create(alice, { roomId: 'general' });
    canvases.get(canvas.id)!.initialMarkdown = '# Draft';

    const claims = await Promise.all([
      service.claimBootstrap(alice, canvas.id),
      service.claimBootstrap(bob, canvas.id),
      service.claimBootstrap(alice, canvas.id),
    ]);

    expect(claims.filter((claim) => claim.claimed)).toEqual([
      { claimed: true, snapshotJson: null, initialMarkdown: '# Draft' },
    ]);
  });

  it('never lets a viewer claim the seed', async () => {
    const { service, canvases } = setup();
    const canvas = await service.create(alice, {});
    await shareWithBob(service, canvas.id, 'viewer');

    expect(await service.claimBootstrap(bob, canvas.id)).toEqual({
      claimed: false,
      snapshotJson: null,
      initialMarkdown: null,
    });
    expect(canvases.get(canvas.id)!.seededAt).toBeNull();
  });

  it('skips a snapshot save whose hash matches the stored one', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {});
    const snapshot = {
      canvasId: canvas.id,
      snapshotJson: { root: {} },
      markdown: 'Hello',
      contentHash: 'a'.repeat(64),
    };

    expect((await service.saveSnapshot(alice, snapshot)).saved).toBe(true);
    expect((await service.saveSnapshot(alice, snapshot)).saved).toBe(false);
    const next = { markdown: 'Hello again', contentHash: 'b'.repeat(64) };
    expect(
      (await service.saveSnapshot(alice, { ...snapshot, ...next })).saved
    ).toBe(true);
    expect((await service.get(alice, canvas.id)).markdown).toBe('Hello again');
  });

  it('refuses a snapshot from a viewer', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {});
    await shareWithBob(service, canvas.id, 'viewer');
    await expect(
      service.saveSnapshot(bob, {
        canvasId: canvas.id,
        snapshotJson: { root: {} },
        markdown: '',
        contentHash: 'a'.repeat(64),
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('CanvasesService with Postgres', () => {
  const service = new CanvasesService(
    new PrismaCanvasesRepository(prisma),
    new PrismaRoomsRepository(prisma),
    new PrismaWorkspaceMembersRepository(prisma),
    new FakeLiveblocksGateway()
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

  it('lets one of two editors opening a new canvas at once seed it', async () => {
    const canvas = await service.create(owner, { roomId });
    await prisma.canvas.update({
      where: { id: canvas.id },
      data: { initialMarkdown: '# Draft' },
    });

    const claims = await Promise.all([
      service.claimBootstrap(owner, canvas.id),
      service.claimBootstrap(member, canvas.id),
    ]);

    expect(claims.filter((claim) => claim.claimed)).toEqual([
      { claimed: true, snapshotJson: null, initialMarkdown: '# Draft' },
    ]);
    expect((await service.claimBootstrap(owner, canvas.id)).claimed).toBe(
      false
    );
  });

  it('writes a snapshot once per content hash', async () => {
    const canvas = await service.create(owner, {});
    const snapshot = {
      canvasId: canvas.id,
      snapshotJson: { root: { children: [] } },
      markdown: 'Hello',
      contentHash: 'c'.repeat(64),
    };

    const first = await service.saveSnapshot(owner, snapshot);
    const second = await service.saveSnapshot(owner, snapshot);

    expect([first.saved, second.saved]).toEqual([true, false]);
    expect(second.updatedAt).toEqual(first.updatedAt);
    expect(
      await prisma.canvas.findUnique({
        where: { id: canvas.id },
        select: { markdown: true, contentHash: true, updatedById: true },
      })
    ).toEqual({
      markdown: 'Hello',
      contentHash: 'c'.repeat(64),
      updatedById: users.owner,
    });
  });

  it('hides an embedded private channel message from someone outside it', async () => {
    const privateRoom = await prisma.room.create({
      data: {
        organizationId: run,
        name: 'ops',
        visibility: 'PRIVATE',
        members: { create: { userId: users.owner } },
      },
    });
    const message = await prisma.message.create({
      data: {
        roomId: privateRoom.id,
        authorId: users.owner,
        clientId: crypto.randomUUID(),
        body: 'launch codes',
      },
    });
    const canvas = await service.create(owner, {});
    await service.share(owner, {
      canvasId: canvas.id,
      userIds: [users.member],
      role: 'viewer',
    });
    const input = { canvasId: canvas.id, messageIds: [message.id] };

    expect(await service.embeddedMessages(member, input)).toEqual([
      { messageId: message.id, status: 'inaccessible' },
    ]);
    expect(await service.embeddedMessages(owner, input)).toMatchObject([
      {
        status: 'ok',
        message: { body: 'launch codes', room: { name: 'ops' } },
      },
    ]);

    await prisma.message.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), body: '' },
    });
    expect(await service.embeddedMessages(owner, input)).toEqual([
      { messageId: message.id, status: 'deleted' },
    ]);
  });

  it('removes canvases and their shares with their channel', async () => {
    const canvas = await service.create(owner, { roomId });
    await prisma.room.delete({ where: { id: roomId } });
    expect(
      await prisma.canvas.findUnique({ where: { id: canvas.id } })
    ).toBeNull();
  });
});
