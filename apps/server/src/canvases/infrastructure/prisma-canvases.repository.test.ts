import type { CanvasScope } from '@conduit/contract';
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

it('selects the document body only for document reads and maps room policy', async () => {
  const snapshotJson = { root: {} };
  const markdown = '# Spec';
  const findFirst = vi.fn().mockResolvedValue({
    ...stored,
    snapshotJson,
    markdown,
    room,
  });
  const db = { canvas: { findFirst } } as unknown as PrismaService;
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
