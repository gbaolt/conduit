import type { CanvasScope } from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { expect, it, vi } from 'vitest';

import type { PrismaService } from '@/infrastructure/database/prisma.service';

import { PrismaCanvasesRepository } from './prisma-canvases.repository';

const scope = { userId: 'viewer', organizationId: 'org' };
const stored = {
  id: 'canvas',
  organizationId: scope.organizationId,
  roomId: 'channel',
  title: 'Spec',
  icon: null,
  coverPreset: null,
  createdById: 'author',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  updatedBy: null,
  members: [],
};
const room = {
  organizationId: scope.organizationId,
  name: 'design',
  kind: 'CHANNEL',
  visibility: 'PRIVATE',
  postAudience: 'MANAGERS',
  replyAudience: 'EVERYONE',
  mentionEveryoneAudience: 'MANAGERS',
  defaultForOrganizationId: scope.organizationId,
  archivedAt: new Date(1),
  members: [
    {
      role: 'MANAGER',
      starredAt: null,
      sectionId: null,
      notify: 'MENTIONS',
      mutedAt: null,
      closedAt: null,
    },
  ],
};

it('uses the same document projection and room policy for reads and writes', async () => {
  const snapshotJson = { root: {} };
  const markdown = '# Spec';
  const row = {
    ...stored,
    snapshotJson,
    markdown,
    room,
  };
  const findFirst = vi.fn().mockResolvedValue(row);
  const create = vi
    .fn()
    .mockResolvedValueOnce(row)
    .mockResolvedValueOnce({
      ...row,
      roomId: null,
      room: null,
      members: [{ role: 'EDITOR' }],
    });
  const update = vi.fn().mockResolvedValue(row);
  const db = {
    canvas: { findFirst, create, update },
  } as unknown as PrismaService;
  const repository = new PrismaCanvasesRepository(db);

  const meta = await repository.findMeta(scope, 'canvas');
  const document = await repository.findDocument(scope, 'canvas');
  const [metaQuery, documentQuery] = findFirst.mock.calls.map(
    ([query]) => query
  );

  expect(meta).toMatchObject({
    roomKind: 'channel',
    roomName: 'design',
    roomPolicy: {
      kind: 'channel',
      visibility: 'private',
      permissions: {
        post: 'managers',
        reply: 'everyone',
        mentionEveryone: 'managers',
      },
      isDefault: true,
      archivedAt: room.archivedAt,
      membership: { role: 'manager', notify: 'mentions' },
    },
  });
  expect(meta).not.toHaveProperty('snapshotJson');
  expect(meta).not.toHaveProperty('markdown');
  expect(document).toEqual({ ...meta, snapshotJson, markdown });
  expect(metaQuery.where).toEqual({
    id: 'canvas',
    organizationId: 'org',
    deletedAt: null,
  });
  expect(metaQuery.select).not.toHaveProperty('snapshotJson');
  expect(metaQuery.select).not.toHaveProperty('markdown');
  expect(metaQuery.select.room.select.members).toMatchObject({
    where: { userId: scope.userId },
    select: { role: true },
  });
  expect(documentQuery).toEqual({
    ...metaQuery,
    select: { ...metaQuery.select, snapshotJson: true, markdown: true },
  });
  await expect(
    repository.createInChannel(scope, stored.roomId, stored.title)
  ).resolves.toEqual(document);
  await expect(
    repository.createStandalone(scope, stored.title)
  ).resolves.toEqual({
    ...document,
    roomId: null,
    roomKind: null,
    roomName: null,
    roomPolicy: null,
    viewerRole: 'editor',
  });
  await expect(
    repository.update(scope, stored.id, { snapshotJson, markdown })
  ).resolves.toEqual(document);
  expect(create.mock.calls.map(([query]) => query.select)).toEqual([
    documentQuery.select,
    documentQuery.select,
  ]);
  expect(update).toHaveBeenCalledExactlyOnceWith({
    where: {
      id: stored.id,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    data: expect.objectContaining({
      updatedById: scope.userId,
      snapshotJson,
      markdown,
    }),
    select: documentQuery.select,
  });
  expect(findFirst).toHaveBeenCalledTimes(2);
});

it('returns null when the scoped canvas update matches no row', async () => {
  const update = vi.fn().mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: Prisma.prismaVersion.client,
    })
  );
  const db = { canvas: { update } } as unknown as PrismaService;
  const repository = new PrismaCanvasesRepository(db);

  await expect(repository.update(scope, stored.id, {})).resolves.toBeNull();
  expect(update).toHaveBeenCalledTimes(1);
});

const snapshot = {
  snapshotJson: { root: {} },
  markdown: '# Spec',
  contentHash: 'hash',
};

it.each([true, false])(
  'returns the timestamp in one snapshot statement (saved: %s)',
  async (saved) => {
    const result = { saved, updatedAt: new Date(1) };
    const $queryRaw = vi.fn().mockResolvedValue([result]);
    const findUniqueOrThrow = vi.fn();
    const db = {
      $queryRaw,
      canvas: { findUniqueOrThrow },
    } as unknown as PrismaService;
    const repository = new PrismaCanvasesRepository(db);

    await expect(
      repository.saveSnapshot(scope, stored.id, snapshot)
    ).resolves.toEqual(result);
    expect($queryRaw).toHaveBeenCalledExactlyOnceWith(
      expect.arrayContaining([
        expect.stringMatching(/WHERE id = $/),
        expect.stringMatching(/^\s+AND "organizationId" = $/),
        expect.stringMatching(
          /^\s+AND "deletedAt" IS NULL\s+FOR NO KEY UPDATE/
        ),
      ]),
      stored.id,
      scope.organizationId,
      JSON.stringify(snapshot.snapshotJson),
      snapshot.markdown,
      snapshot.contentHash,
      scope.userId,
      expect.any(Date),
      snapshot.contentHash
    );
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  }
);

it('reports a missing snapshot target without another query', async () => {
  const $queryRaw = vi.fn().mockResolvedValue([]);
  const db = { $queryRaw } as unknown as PrismaService;
  const repository = new PrismaCanvasesRepository(db);

  await expect(
    repository.saveSnapshot(scope, stored.id, snapshot)
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect($queryRaw).toHaveBeenCalledTimes(1);
});

it('retains the room ID but clears room metadata for a room in another workspace', async () => {
  const findFirst = vi.fn().mockResolvedValue({
    ...stored,
    room: { ...room, organizationId: 'another-org' },
  });
  const db = { canvas: { findFirst } } as unknown as PrismaService;
  const repository = new PrismaCanvasesRepository(db);

  await expect(repository.findMeta(scope, stored.id)).resolves.toMatchObject({
    roomId: stored.roomId,
    roomPolicy: null,
    roomKind: null,
    roomName: null,
  });
});

it('reads soft-deleted link metadata and room policy within the workspace', async () => {
  const markdown = '# Spec';
  const deletedAt = new Date(2);
  const findFirst = vi.fn().mockResolvedValue({
    ...stored,
    room,
    markdown,
    deletedAt,
  });
  const db = { canvas: { findFirst } } as unknown as PrismaService;
  const repository = new PrismaCanvasesRepository(db);

  await expect(repository.findForLink(scope, stored.id)).resolves.toMatchObject(
    {
      markdown,
      deletedAt,
      roomPolicy: { visibility: 'private', membership: { role: 'manager' } },
    }
  );
  expect(findFirst).toHaveBeenCalledExactlyOnceWith({
    where: { id: stored.id, organizationId: scope.organizationId },
    select: expect.objectContaining({ markdown: true, deletedAt: true }),
  });
  const select = findFirst.mock.calls[0]?.[0].select;
  expect(select).toHaveProperty('room.select.visibility', true);
  expect(select).toHaveProperty(
    'room.select.members.where.userId',
    scope.userId
  );
  expect(select).not.toHaveProperty('snapshotJson');
});

it.each<CanvasScope>(['all', 'channel', 'shared'])(
  'queries the %s list with access filters and a metadata projection',
  async (canvasScope) => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { canvas: { findMany } } as unknown as PrismaService;
    const repository = new PrismaCanvasesRepository(db);
    const shared = {
      roomId: null,
      members: { some: { userId: scope.userId } },
    };
    const inRooms = {
      room: {
        organizationId: scope.organizationId,
        OR: [
          { kind: 'CHANNEL', visibility: 'PUBLIC' },
          { members: { some: { userId: scope.userId } } },
        ],
      },
    };
    const scopeFilter = {
      all: { OR: [inRooms, shared] },
      channel: inRooms,
      shared,
    };

    await expect(repository.list(scope, canvasScope)).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...scopeFilter[canvasScope],
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    const select = findMany.mock.calls[0]?.[0].select;
    expect(select).not.toHaveProperty('snapshotJson');
    expect(select).not.toHaveProperty('markdown');
    if (canvasScope === 'shared') {
      expect(select).not.toHaveProperty('room');
    } else {
      expect(select).toHaveProperty('room.select.archivedAt', true);
      expect(select).toHaveProperty(
        'room.select.members.where.userId',
        scope.userId
      );
    }
  }
);

it('looks up names only for active members of the requested workspace', async () => {
  const findMany = vi.fn().mockResolvedValue([{ id: 'member', name: 'Bao' }]);
  const db = { user: { findMany } } as unknown as PrismaService;
  const repository = new PrismaCanvasesRepository(db);
  const ids = ['member', 'outside', 'deactivated'];

  await expect(repository.workspaceUserNames('org', ids)).resolves.toEqual(
    new Map([['member', 'Bao']])
  );
  expect(findMany).toHaveBeenCalledExactlyOnceWith({
    where: {
      id: { in: ids },
      members: { some: { organizationId: 'org', deactivation: null } },
    },
    select: { id: true, name: true },
  });
});
