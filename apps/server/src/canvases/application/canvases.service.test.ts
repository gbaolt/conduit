import type { CanvasRole, Room } from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { CanvasCommentsRepository } from '@/canvases/domain/canvas-comments.repository';
import { canvasError } from '@/canvases/domain/canvas-errors';
import type {
  CanvasesRepository,
  CanvasMeta,
  CanvasScopeOf,
  CanvasSeed,
  StoredCanvas,
  StoredCanvasDocument,
  StoredEmbeddedMessage,
} from '@/canvases/domain/canvases.repository';
import { PrismaCanvasVersionsRepository } from '@/canvases/infrastructure/prisma-canvas-versions.repository';
import { PrismaCanvasesRepository } from '@/canvases/infrastructure/prisma-canvases.repository';
import { FakeCanvasVersionsRepository } from '@/canvases/testing/fake-canvas-versions.repository';
import { FakeLiveblocksGateway } from '@/canvases/testing/fake-liveblocks.gateway';
import { prisma } from '@/infrastructure/database/prisma.service';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';
import { PrismaRoomsRepository } from '@/rooms/infrastructure/prisma-rooms.repository';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { CanvasCommentsService } from './canvas-comments.service';
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

function setup(
  room: Room = roomFor(),
  roomMembers = ['alice', 'bob'],
  liveblocks = new FakeLiveblocksGateway(),
  embedded: EmbeddedFixture[] = []
) {
  const canvases = new Map<
    string,
    Omit<StoredCanvasDocument, 'viewerRole' | 'roomPolicy'> & {
      deletedAt: Date | null;
      seededAt: Date | null;
      contentHash: string | null;
      initialMarkdown: string | null;
      sourceThreadId: string | null;
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
  const asSeenBy = (userId: string): Room => ({
    ...room,
    membership: roomMembers.includes(userId) ? room.membership : null,
  });
  const visibleTo = (userId: string) => {
    const seen = asSeenBy(userId);
    return seen.visibility === 'public' || seen.membership !== null;
  };
  const read = (scope: CanvasScopeOf, id: string, includeDeleted = false) => {
    const row = canvases.get(id);
    return row?.organizationId === scope.organizationId &&
      (includeDeleted || !row.deletedAt)
      ? row
      : null;
  };
  const canvasOf = (
    row: NonNullable<ReturnType<typeof read>>,
    userId: string
  ): StoredCanvas => ({
    id: row.id,
    organizationId: row.organizationId,
    roomId: row.roomId,
    roomKind: row.roomKind,
    roomName: row.roomName,
    title: row.title,
    icon: row.icon,
    coverPreset: row.coverPreset,
    createdById: row.createdById,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    viewerRole: shares.get(row.id)?.get(userId) ?? null,
  });
  const metaOf = (
    row: NonNullable<ReturnType<typeof read>>,
    userId: string
  ): CanvasMeta => ({
    ...canvasOf(row, userId),
    roomPolicy: row.roomId === room.id ? asSeenBy(userId) : null,
  });
  const documentOf = (
    row: NonNullable<ReturnType<typeof read>>,
    userId: string
  ): StoredCanvasDocument => ({
    ...metaOf(row, userId),
    snapshotJson: row.snapshotJson,
    markdown: row.markdown,
  });
  const insert = (
    roomId: string | null,
    title: string,
    userId: string,
    seed: CanvasSeed = {}
  ) => {
    const id = `canvas-${++next}`;
    const row = {
      id,
      organizationId,
      roomId,
      roomKind: roomId ? room.kind : null,
      roomName: roomId && room.kind === 'channel' ? room.name : null,
      title,
      icon: null,
      coverPreset: null,
      createdById: userId,
      updatedByName: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      snapshotJson: seed.snapshotJson ?? null,
      markdown: seed.markdown ?? '',
      deletedAt: null,
      seededAt: null,
      contentHash: seed.contentHash ?? null,
      initialMarkdown: seed.initialMarkdown ?? null,
      sourceThreadId: seed.sourceThreadId ?? null,
    };
    canvases.set(id, row);
    shares.set(id, new Map(roomId ? [] : [[userId, 'editor']]));
    return documentOf(row, userId);
  };
  const workspaceUserNames = vi.fn<CanvasesRepository['workspaceUserNames']>(
    async () => new Map()
  );
  const repository = {
    findMeta: vi.fn<CanvasesRepository['findMeta']>(async (scope, id) => {
      const row = read(scope, id);
      return row && metaOf(row, scope.userId);
    }),
    findDocument: vi.fn<CanvasesRepository['findDocument']>(
      async (scope, id) => {
        const row = read(scope, id);
        return row && documentOf(row, scope.userId);
      }
    ),
    findForLink: async (scope, id) => {
      const row = read(scope, id, true);
      return (
        row && {
          ...metaOf(row, scope.userId),
          markdown: row.markdown,
          deletedAt: row.deletedAt,
        }
      );
    },
    listInChannel: async (scope, roomId) =>
      [...canvases.values()]
        .filter((c) => c.roomId === roomId && !c.deletedAt)
        .map((c) => canvasOf(c, scope.userId)),
    createInChannel: async (scope, roomId, title, seed) =>
      insert(roomId, title, scope.userId, seed),
    createStandalone: async (scope, title, seed) =>
      insert(null, title, scope.userId, seed),
    list: vi.fn<CanvasesRepository['list']>(async (scope, canvasScope) =>
      [...canvases.values()]
        .filter(
          (row) => !row.deletedAt && row.organizationId === scope.organizationId
        )
        .map((row) => metaOf(row, scope.userId))
        .filter((row) =>
          row.roomId
            ? canvasScope !== 'shared' && visibleTo(scope.userId)
            : canvasScope !== 'channel' && row.viewerRole !== null
        )
    ),
    update: async (scope, id, patch) => {
      const row = read(scope, id);
      if (!row) return null;
      const updated = {
        ...row,
        ...patch,
        updatedByName: scope.userId,
        updatedAt: new Date(),
      };
      canvases.set(id, updated);
      return documentOf(updated, scope.userId);
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
    saveSnapshot: async (scope, id, snapshot) => {
      const row = read(scope, id);
      if (!row) throw canvasError('NOT_FOUND');
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
    userNames: async (ids) => new Map(ids.map((id) => [id, id])),
    workspaceUserNames,
  } satisfies CanvasesRepository;
  const rooms = {
    find: vi.fn<RoomsRepository['find']>(async (scope, id) =>
      id === room.id ? asSeenBy(scope.userId) : null
    ),
    accessibleRoomIds: vi.fn<RoomsRepository['accessibleRoomIds']>(
      async (scope) => [
        ...(visibleTo(scope.userId) ? [room.id] : []),
        ...embedded
          .filter(({ readers }) => readers.includes(scope.userId))
          .map(({ message }) => message.room.id),
      ]
    ),
  } satisfies Partial<RoomsRepository>;
  const versions = new FakeCanvasVersionsRepository();
  const workspaceMembers = {
    count: async (_org: string, userIds: string[]) =>
      userIds.filter((id) => ['alice', 'bob', 'carol'].includes(id)).length,
  } as Partial<WorkspaceMembersRepository> as WorkspaceMembersRepository;
  return {
    service: new CanvasesService(
      repository,
      rooms as Partial<RoomsRepository> as RoomsRepository,
      workspaceMembers,
      liveblocks,
      versions
    ),
    canvases,
    liveblocks,
    repository,
    rooms,
    versions,
    workspaceUserNames,
  };
}

describe('CanvasesService', () => {
  it.each(['update', 'saveSnapshot'] as const)(
    'rejects %s when the canvas is deleted after load',
    async (method) => {
      const { service, canvases, repository, versions } = setup();
      const canvas = await service.create(alice, {});
      const before = canvases.get(canvas.id);
      const createIfDue = vi.spyOn(versions, 'createIfDue');
      const load = service.load.bind(service);
      vi.spyOn(service, 'load').mockImplementationOnce(async (...args) => {
        const loaded = await load(...args);
        await repository.softDelete(canvas.id);
        return loaded;
      });
      const patch = {
        canvasId: canvas.id,
        snapshotJson: { root: {} },
        markdown: 'Updated content',
      };

      await expect(
        method === 'update'
          ? service.update(alice, patch)
          : service.saveSnapshot(alice, {
              ...patch,
              contentHash: 'a'.repeat(64),
            })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(createIfDue).not.toHaveBeenCalled();
      expect(canvases.get(canvas.id)).toEqual({
        ...before,
        deletedAt: expect.any(Date),
      });
    }
  );

  it('returns the updated document and access with only the pre-write authorization read', async () => {
    const { service, repository, canvases, versions } = setup();
    const created = await service.create(alice, { roomId: 'general' });
    const snapshotJson = { root: { children: [] } };

    const updated = await service.update(bob, {
      canvasId: created.id,
      title: 'Updated spec',
      icon: '📄',
      coverPreset: 'mint',
      snapshotJson,
      markdown: '# Updated',
    });

    expect(repository.findMeta).toHaveBeenCalledExactlyOnceWith(
      bob,
      created.id
    );
    expect(repository.findDocument).not.toHaveBeenCalled();
    expect(updated).toEqual({
      id: created.id,
      organizationId,
      roomId: 'general',
      roomKind: 'channel',
      roomName: 'general',
      title: 'Updated spec',
      icon: '📄',
      coverPreset: 'mint',
      createdById: alice.userId,
      updatedByName: bob.userId,
      createdAt: created.createdAt,
      updatedAt: canvases.get(created.id)?.updatedAt,
      viewerRole: null,
      snapshotJson,
      markdown: '# Updated',
      access: {
        edit: true,
        comment: true,
        manageSharing: false,
        delete: false,
      },
    });
    expect(versions.rows).toMatchObject([
      {
        canvasId: created.id,
        trigger: 'auto',
        snapshotJson,
        markdown: '# Updated',
      },
    ]);
    await expect(service.get(bob, created.id)).resolves.toEqual(updated);
  });

  it('uses metadata for load, Liveblocks auth, and comment lists', async () => {
    const { service, repository, rooms, liveblocks } = setup(
      roomFor({ kind: 'dm', visibility: 'private' })
    );
    const content = { snapshotJson: { root: {} }, markdown: '# Draft' };
    const canvas = await service.create(alice, {
      ...content,
      roomId: 'general',
    });
    repository.findDocument.mockClear();
    rooms.find.mockClear();

    const list = vi
      .fn<CanvasCommentsRepository['list']>()
      .mockResolvedValue([]);
    const comments = new CanvasCommentsService(service, {
      list,
    } as Partial<CanvasCommentsRepository> as CanvasCommentsRepository);

    const loaded = await service.load(bob, canvas.id, 'view');
    expect(loaded.canvas).not.toHaveProperty('snapshotJson');
    expect(loaded.canvas).not.toHaveProperty('markdown');
    await service.liveblocksAuth(bob, canvas.id, { name: 'Bob' });
    expect(liveblocks.grants[0]?.permissions).toEqual(['room:write']);

    await expect(comments.list(bob, canvas.id)).resolves.toEqual([]);
    await expect(comments.list(carol, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(list).toHaveBeenCalledExactlyOnceWith(canvas.id);
    await expect(
      service.liveblocksAuth(carol, canvas.id, { name: 'Carol' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(repository.findMeta).toHaveBeenCalledTimes(5);
    expect(repository.findDocument).not.toHaveBeenCalled();
    expect(rooms.find).not.toHaveBeenCalled();

    await expect(service.get(bob, canvas.id)).resolves.toMatchObject(content);
    expect(repository.findDocument).toHaveBeenCalledExactlyOnceWith(
      bob,
      canvas.id
    );
    expect(repository.findMeta).toHaveBeenCalledTimes(5);
    expect(rooms.find).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'public channel visitor',
      room: {},
      viewer: carol,
      read: true,
      edit: false,
    },
    {
      name: 'private channel outsider',
      room: { visibility: 'private' },
      viewer: carol,
      read: false,
      edit: false,
    },
    {
      name: 'private channel member',
      room: { visibility: 'private' },
      viewer: bob,
      read: true,
      edit: true,
    },
    {
      name: 'DM outsider',
      room: { kind: 'dm', visibility: 'private' },
      viewer: carol,
      read: false,
      edit: false,
    },
    {
      name: 'DM member',
      room: { kind: 'dm', visibility: 'private' },
      viewer: bob,
      read: true,
      edit: true,
    },
    {
      name: 'archived channel member',
      room: {},
      viewer: bob,
      archived: true,
      read: true,
      edit: false,
    },
  ] satisfies {
    name: string;
    room: Partial<Room>;
    viewer: CanvasViewerScope;
    archived?: boolean;
    read: boolean;
    edit: boolean;
  }[])(
    'lists canvases by scope for a $name',
    async ({ room: overrides, viewer, archived, read, edit }) => {
      const room = roomFor(overrides);
      const { service, repository, rooms } = setup(room);
      const inRoom = await service.create(alice, {
        roomId: room.id,
        markdown: 'Room body',
      });
      if (archived) room.archivedAt = new Date();
      const shared = await service.create(alice, { markdown: 'Shared body' });
      await service.create(alice, {});
      await service.share(alice, {
        canvasId: shared.id,
        userIds: [viewer.userId],
        role: 'viewer',
      });
      rooms.find.mockClear();

      const [all, channel, standalone] = await Promise.all([
        service.list(viewer, 'all'),
        service.list(viewer, 'channel'),
        service.list(viewer, 'shared'),
      ]);

      expect(all.map((canvas) => canvas.id)).toEqual(
        read ? [inRoom.id, shared.id] : [shared.id]
      );
      expect(channel.map((canvas) => canvas.id)).toEqual(
        read ? [inRoom.id] : []
      );
      expect(standalone.map((canvas) => canvas.id)).toEqual([shared.id]);
      if (read) {
        expect(channel[0]?.access).toMatchObject({ edit, comment: edit });
      }
      for (const canvas of all) {
        expect(canvas).not.toHaveProperty('markdown');
        expect(canvas).not.toHaveProperty('snapshotJson');
        expect(canvas).not.toHaveProperty('roomPolicy');
      }
      expect(repository.list.mock.calls).toEqual([
        [viewer, 'all'],
        [viewer, 'channel'],
        [viewer, 'shared'],
      ]);
      expect(rooms.find).not.toHaveBeenCalled();
      expect(rooms.accessibleRoomIds).not.toHaveBeenCalled();
    }
  );

  it('adds a new canvas to the channel on every create, listed oldest first', async () => {
    const { service } = setup();
    expect(await service.listRoomCanvases(alice, 'general')).toEqual([]);

    const first = await service.create(alice, { roomId: 'general' });
    const second = await service.create(bob, { roomId: 'general' });

    expect(second.id).not.toBe(first.id);
    expect(first).toMatchObject({
      title: 'Untitled',
      roomKind: 'channel',
      roomName: 'general',
    });
    expect(
      (await service.listRoomCanvases(bob, 'general')).map((c) => c.id)
    ).toEqual([first.id, second.id]);
  });

  it('does not read canvases when room authorization denies access', async () => {
    const { service, repository } = setup(roomFor({ visibility: 'private' }));
    const list = vi
      .spyOn(repository, 'listInChannel')
      .mockRejectedValue(new Error('Room canvases read failed'));

    await expect(
      service.listRoomCanvases(carol, 'general')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(list).not.toHaveBeenCalled();
  });

  it('sets and clears the icon and cover', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, { roomId: 'general' });

    expect(
      await service.update(bob, {
        canvasId: canvas.id,
        icon: '🚀',
        coverPreset: 'ocean',
      })
    ).toMatchObject({ icon: '🚀', coverPreset: 'ocean' });
    expect(
      await service.update(bob, {
        canvasId: canvas.id,
        icon: null,
        coverPreset: null,
      })
    ).toMatchObject({ icon: null, coverPreset: null });
  });

  it('keeps a DM canvas to the people in the DM, with no room name', async () => {
    const { service } = setup(
      roomFor({ kind: 'dm', visibility: 'private', name: 'dm-key' }),
      ['alice', 'bob']
    );
    const canvas = await service.create(alice, { roomId: 'general' });

    expect(canvas).toMatchObject({ roomKind: 'dm', roomName: null });
    expect(
      (await service.listRoomCanvases(bob, 'general')).map((c) => c.id)
    ).toEqual([canvas.id]);
    expect((await service.list(bob, 'all')).map((c) => c.id)).toEqual([
      canvas.id,
    ]);
    await expect(
      service.listRoomCanvases(carol, 'general')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await service.list(carol, 'all')).toEqual([]);
  });

  it('hides a private channel canvas from people outside the channel', async () => {
    const { service } = setup(roomFor({ visibility: 'private' }), ['alice']);
    const canvas = await service.create(alice, { roomId: 'general' });

    await expect(service.get(carol, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      service.listRoomCanvases(carol, 'general')
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

  it('drops a deleted canvas from the channel tabs', async () => {
    const { service } = setup();
    const first = await service.create(alice, { roomId: 'general' });
    await expect(service.delete(bob, first.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    await service.delete(alice, first.id);

    await expect(service.get(alice, first.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await service.listRoomCanvases(alice, 'general')).toEqual([]);
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

describe('CanvasesService AI drafts', () => {
  const snapshotJson = { root: { children: [], type: 'root' } };
  const draft = {
    title: 'Search filters',
    initialMarkdown: '## Scope',
    markdown: '## Scope',
    snapshotJson,
    sourceThreadId: 'message-in-product',
    sourceMessageIds: ['message-in-product'],
    versionTrigger: 'ai_draft' as const,
  };
  const thread = () => [embeddedIn('product', 'channel', ['alice'])];

  it('creates the channel canvas with the draft and records it as version 1', async () => {
    const { service, canvases, repository, versions } = setup(
      roomFor(),
      ['alice', 'bob'],
      undefined,
      thread()
    );

    const canvas = await service.create(alice, { ...draft, roomId: 'general' });

    const stored = canvases.get(canvas.id);
    expect(canvas).toEqual({
      id: 'canvas-1',
      organizationId,
      roomId: 'general',
      roomKind: 'channel',
      roomName: 'general',
      title: 'Search filters',
      icon: null,
      coverPreset: null,
      createdById: alice.userId,
      updatedByName: alice.userId,
      createdAt: stored?.createdAt,
      updatedAt: stored?.updatedAt,
      viewerRole: null,
      snapshotJson,
      markdown: '## Scope',
      access: { edit: true, comment: true, manageSharing: false, delete: true },
    });
    expect(repository.findDocument).not.toHaveBeenCalled();
    expect(repository.findMeta).not.toHaveBeenCalled();
    await expect(service.get(alice, canvas.id)).resolves.toEqual(canvas);
    expect(canvases.get(canvas.id)).toMatchObject({
      snapshotJson,
      initialMarkdown: '## Scope',
      sourceThreadId: 'message-in-product',
    });
    expect(versions.rows).toMatchObject([
      { canvasId: canvas.id, trigger: 'ai_draft', label: null, author: null },
    ]);
    expect(await service.claimBootstrap(alice, canvas.id)).toEqual({
      claimed: true,
      snapshotJson: JSON.stringify(snapshotJson),
      initialMarkdown: '## Scope',
    });
  });

  it('refuses a channel canvas from someone who cannot post', async () => {
    const { service } = setup(roomFor(), ['alice']);
    await expect(
      service.create(carol, { roomId: 'general' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('creates a standalone draft only its creator can open', async () => {
    const { service, repository } = setup(
      roomFor(),
      ['alice', 'bob'],
      undefined,
      thread()
    );

    const canvas = await service.create(alice, draft);

    expect(repository.findDocument).not.toHaveBeenCalled();
    expect(repository.findMeta).not.toHaveBeenCalled();
    expect(canvas).toMatchObject({
      roomId: null,
      roomKind: null,
      roomName: null,
      title: 'Search filters',
      viewerRole: 'editor',
      access: { edit: true, comment: true, manageSharing: true, delete: true },
    });
    await expect(service.get(alice, canvas.id)).resolves.toEqual(canvas);
    await expect(service.get(bob, canvas.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await service.list(bob, 'all')).toEqual([]);
  });

  it('refuses source messages the creator cannot read', async () => {
    const { service, canvases } = setup(
      roomFor(),
      ['alice', 'bob'],
      undefined,
      thread()
    );

    await expect(service.create(bob, draft)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      service.create(alice, { ...draft, sourceMessageIds: ['invented'] })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(canvases.size).toBe(0);
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

  it('does not read rooms or messages when canvas authorization denies access', async () => {
    const { service, repository, rooms } = setup(
      roomFor(),
      ['alice', 'bob'],
      undefined,
      embeds
    );
    const canvas = await service.create(alice, {});
    const findMessages = vi
      .spyOn(repository, 'findMessages')
      .mockRejectedValue(new Error('Messages read failed'));
    rooms.accessibleRoomIds.mockRejectedValue(new Error('Rooms read failed'));

    await expect(
      service.embeddedMessages(bob, { canvasId: canvas.id, messageIds: [open] })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(rooms.accessibleRoomIds).not.toHaveBeenCalled();
    expect(findMessages).not.toHaveBeenCalled();
  });
});

describe('CanvasesService link cards', () => {
  it('returns inaccessible for a missing canvas', async () => {
    const { service } = setup();

    expect(await service.linkCard(alice, 'missing')).toEqual({
      status: 'inaccessible',
    });
  });

  it.each([carol, viewerOf('carol', 'admin')])(
    'hides a live private channel canvas from a workspace $workspaceRole outside the channel',
    async (viewer) => {
      const { service, workspaceUserNames } = setup(
        roomFor({ visibility: 'private' }),
        ['alice']
      );
      const canvas = await service.create(alice, {
        roomId: 'general',
        markdown: 'Hi <@alice>',
      });

      expect(await service.linkCard(viewer, canvas.id)).toEqual({
        status: 'inaccessible',
      });
      expect(workspaceUserNames).not.toHaveBeenCalled();
    }
  );

  it('shows a DM canvas to members without exposing a room name', async () => {
    const { service } = setup(
      roomFor({ kind: 'dm', visibility: 'private', name: 'dm-key' })
    );
    const canvas = await service.create(alice, { roomId: 'general' });

    expect(await service.linkCard(bob, canvas.id)).toMatchObject({
      status: 'ok',
      canvas: { id: canvas.id, roomKind: 'dm', roomName: null },
    });
    expect(await service.linkCard(carol, canvas.id)).toEqual({
      status: 'inaccessible',
    });
  });

  it('returns the shared room canvas with a capped plain-text excerpt', async () => {
    const { service } = setup(roomFor({ visibility: 'private' }));
    const canvas = await service.create(alice, {
      roomId: 'general',
      title: 'Project plan',
      markdown: `# Project plan\n\n- **Read** the [brief](https://example.com).\n\n${'x'.repeat(200)}`,
    });
    const updated = await service.update(alice, {
      canvasId: canvas.id,
      icon: '📋',
      coverPreset: 'ocean',
    });
    const start = 'Project plan Read the brief. ';

    expect(await service.linkCard(bob, canvas.id)).toEqual({
      status: 'ok',
      canvas: {
        id: canvas.id,
        title: 'Project plan',
        icon: '📋',
        coverPreset: 'ocean',
        roomId: 'general',
        roomKind: 'channel',
        roomName: 'general',
        excerpt: start + 'x'.repeat(200 - start.length),
        updatedAt: updated.updatedAt,
        updatedByName: 'alice',
      },
    });
  });

  it('keeps the text of canvas task lists, tables, and toggles', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {
      title: 'Project plan',
      markdown: [
        '- [x] Done',
        '',
        '---',
        '',
        '| Role | Name |',
        '| --- | --- |',
        '| Lead | Alice |',
        '',
        '<details><summary>Next</summary>',
        '',
        'Send it.',
        '',
        '</details>',
      ].join('\n'),
    });

    expect(await service.linkCard(alice, canvas.id)).toMatchObject({
      status: 'ok',
      canvas: { excerpt: 'Done Role Name Lead Alice Next Send it.' },
    });
  });

  it('preserves code and link labels, strips attributed tags, and decodes entities', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {
      markdown: [
        '<details open><summary title="a > b">R&amp;D</summary>',
        '`snake_case` [doc](https://example.test/wiki_(x(y)) "a ) title")',
        '&#x1F680; &#65; &lt;ok&gt;</details>',
        '```ts',
        'const snake_case = "*literal*";',
        '```',
      ].join('\n'),
    });

    expect(await service.linkCard(alice, canvas.id)).toMatchObject({
      status: 'ok',
      canvas: {
        excerpt: 'R&D snake_case doc 🚀 A <ok> const snake_case = "*literal*";',
      },
    });
  });

  it('keeps later lines after an unclosed link destination', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {
      markdown: 'See [the plan](draft\n\nThe deadline is Friday.',
    });

    expect(await service.linkCard(alice, canvas.id)).toMatchObject({
      status: 'ok',
      canvas: { excerpt: 'See the plan The deadline is Friday.' },
    });
  });

  it('renders a line-start inline code span and parses the following prose', async () => {
    const { service, workspaceUserNames } = setup();
    workspaceUserNames.mockResolvedValue(new Map([['alice', 'Alice']]));
    const canvas = await service.create(alice, {
      markdown: '```x_y```\n\nAfter **review** <@alice>',
    });

    expect(await service.linkCard(alice, canvas.id)).toMatchObject({
      status: 'ok',
      canvas: { excerpt: 'x_y After review @Alice' },
    });
  });

  it('resolves unique mention IDs in the canvas workspace and drops missing names', async () => {
    const { service, workspaceUserNames } = setup();
    workspaceUserNames.mockResolvedValue(new Map([['usr_member', 'Bao']]));
    const canvas = await service.create(alice, {
      markdown: 'Hi <@usr_member> <@usr_outside> and <@usr_member>.',
    });

    expect(await service.linkCard(alice, canvas.id)).toMatchObject({
      status: 'ok',
      canvas: { excerpt: 'Hi @Bao and @Bao.' },
    });
    expect(workspaceUserNames).toHaveBeenCalledExactlyOnceWith(organizationId, [
      'usr_member',
      'usr_outside',
    ]);
  });

  it.each([
    [197, ''],
    [195, '👩‍💻'],
  ])(
    'fits a whole grapheme within the excerpt cap after %i ASCII characters',
    async (length, emoji) => {
      const { service } = setup();
      const prefix = 'a'.repeat(length);
      const canvas = await service.create(alice, {
        markdown: `${prefix}👩‍💻tail`,
      });

      expect(await service.linkCard(alice, canvas.id)).toMatchObject({
        status: 'ok',
        canvas: { excerpt: prefix + emoji },
      });
    }
  );

  it('builds a link card for 200,000 unmatched brackets in under 100 ms', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {
      markdown: '['.repeat(200_000),
    });

    const started = performance.now();
    const card = await service.linkCard(alice, canvas.id);
    const elapsed = performance.now() - started;

    console.info(`200,000-bracket link card took ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(100);
    expect(card).toMatchObject({
      status: 'ok',
      canvas: { excerpt: '['.repeat(200) },
    });
  });

  it('returns inaccessible for a standalone canvas the viewer cannot open', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {
      title: 'Private plan',
      markdown: 'Private content',
    });

    expect(await service.linkCard(bob, canvas.id)).toEqual({
      status: 'inaccessible',
    });
  });

  it('returns a shared standalone card until the viewer loses the share', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, { title: 'Shared plan' });
    await service.share(alice, {
      canvasId: canvas.id,
      userIds: [bob.userId],
      role: 'viewer',
    });

    expect(await service.linkCard(bob, canvas.id)).toMatchObject({
      status: 'ok',
      canvas: { id: canvas.id, roomId: null, roomKind: null, roomName: null },
    });

    await service.removeMember(alice, {
      canvasId: canvas.id,
      userId: bob.userId,
    });
    const missing = await service.linkCard(bob, 'missing');
    expect(missing).toEqual({ status: 'inaccessible' });
    expect(await service.linkCard(bob, canvas.id)).toEqual(missing);
  });

  it('returns inaccessible for a canvas from another workspace', async () => {
    const { service } = setup();
    const canvas = await service.create(alice, {
      roomId: 'general',
      title: 'Workspace plan',
      markdown: 'Workspace content',
    });

    expect(
      await service.linkCard(
        { ...alice, organizationId: 'another-workspace' },
        canvas.id
      )
    ).toEqual({ status: 'inaccessible' });
  });

  it('returns deleted only to viewers who could open the canvas', async () => {
    const { service } = setup(roomFor({ visibility: 'private' }));
    const canvas = await service.create(alice, {
      roomId: 'general',
      title: 'Private channel plan',
    });
    await service.delete(alice, canvas.id);

    expect(await service.linkCard(bob, canvas.id)).toEqual({
      status: 'deleted',
    });
    expect(await service.linkCard(carol, canvas.id)).toEqual({
      status: 'inaccessible',
    });
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
    new FakeLiveblocksGateway(),
    new PrismaCanvasVersionsRepository(prisma)
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

  it('gives two people creating channel canvases at once a canvas each', async () => {
    const [a, b] = await Promise.all([
      service.create(owner, { roomId }),
      service.create(member, { roomId }),
    ]);
    expect(a.id).not.toBe(b.id);
    expect(
      (await service.listRoomCanvases(owner, roomId)).map((c) => c.id)
    ).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it('filters workspace canvas lists by room visibility, membership, and scope', async () => {
    const roomCases = [
      {
        name: 'public-list',
        kind: 'CHANNEL',
        visibility: 'PUBLIC',
        joined: false,
        readable: true,
      },
      {
        name: 'private-list',
        kind: 'CHANNEL',
        visibility: 'PRIVATE',
        joined: true,
        readable: true,
      },
      {
        name: 'hidden-private-list',
        kind: 'CHANNEL',
        visibility: 'PRIVATE',
        joined: false,
        readable: false,
      },
      {
        name: 'dm-list',
        kind: 'DM',
        visibility: 'PRIVATE',
        joined: true,
        readable: true,
      },
      {
        name: 'hidden-dm-list',
        kind: 'DM',
        visibility: 'PRIVATE',
        joined: false,
        readable: false,
      },
      {
        name: 'archived-list',
        kind: 'CHANNEL',
        visibility: 'PUBLIC',
        joined: true,
        readable: true,
      },
    ] as const;
    const entries = await Promise.all(
      roomCases.map(async ({ name, kind, visibility, joined, readable }) => {
        const room = await prisma.room.create({
          data: {
            name,
            kind,
            visibility,
            organizationId: run,
            archivedAt: name === 'archived-list' ? new Date() : null,
            members: { create: joined ? [{ userId: users.member }] : [] },
          },
        });
        const canvas = await prisma.canvas.create({
          data: {
            title: name,
            roomId: room.id,
            organizationId: run,
            createdById: users.owner,
          },
        });
        return { name, id: canvas.id, readable };
      })
    );
    const shared = await service.create(owner, {});
    await service.share(owner, {
      canvasId: shared.id,
      userIds: [users.member],
      role: 'viewer',
    });
    const unshared = await service.create(owner, {});
    const fixtureIds = new Set([
      ...entries.map(({ id }) => id),
      shared.id,
      unshared.id,
    ]);
    const readableIds = entries
      .filter(({ readable }) => readable)
      .map(({ id }) => id);

    const [all, channels, standalone] = await Promise.all([
      service.list(member, 'all'),
      service.list(member, 'channel'),
      service.list(member, 'shared'),
    ]);

    for (const [canvases, ids] of [
      [all, [...readableIds, shared.id]],
      [channels, readableIds],
      [standalone, [shared.id]],
    ] as const) {
      expect(
        canvases
          .map(({ id }) => id)
          .filter((id) => fixtureIds.has(id))
          .sort()
      ).toEqual([...ids].sort());
    }
    expect(
      channels.find(({ title }) => title === 'archived-list')?.access.edit
    ).toBe(false);
    expect(channels.find(({ title }) => title === 'dm-list')?.access.edit).toBe(
      true
    );
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
