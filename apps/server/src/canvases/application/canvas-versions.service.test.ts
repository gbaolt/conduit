import type { Room } from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  AUTO_VERSION_INTERVAL_MS,
  SAFETY_VERSION_LABEL,
} from '@/canvases/domain/canvas-versions.repository';
import type {
  CanvasesRepository,
  StoredCanvasDocument,
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

import { CanvasVersionsService } from './canvas-versions.service';
import {
  CanvasesService,
  type CanvasViewerScope,
  contentHashOf,
} from './canvases.service';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const viewerOf = (userId: string): CanvasViewerScope => ({
  userId,
  organizationId: 'org',
  workspaceRole: 'member',
});
const alice = viewerOf('alice');
const carol = viewerOf('carol');
const dave = viewerOf('dave');

/** alice edits the standalone canvas, carol only views it, and dave is not on it. */
const roles = { alice: 'editor', carol: 'viewer' } as const;

const content = (text: string) => {
  const snapshotJson = { root: { children: [{ text }] } };
  return {
    snapshotJson,
    markdown: text,
    contentHash: contentHashOf(snapshotJson),
  };
};

const archived: Room = {
  id: 'general',
  organizationId: 'org',
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
  archivedAt: new Date(),
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
};

/** A real `CanvasesService` over one in-memory canvas, standalone unless `room` is given. */
function setup(room: Room | null = null) {
  const versions = new FakeCanvasVersionsRepository();
  const repository = {
    find: async (scope, id): Promise<StoredCanvasDocument | null> =>
      id === 'canvas'
        ? {
            id,
            organizationId: 'org',
            roomId: room?.id ?? null,
            roomName: room?.name ?? null,
            title: 'Spec',
            icon: null,
            coverPreset: null,
            createdById: 'alice',
            updatedByName: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            viewerRole: room
              ? null
              : (roles[scope.userId as keyof typeof roles] ?? null),
            snapshotJson: null,
            markdown: '',
          }
        : null,
    saveSnapshot: async () => ({ saved: true, updatedAt: new Date() }),
    update: async () => {},
  } satisfies Partial<CanvasesRepository> as unknown as CanvasesRepository;
  const rooms = {
    find: async (_scope: unknown, id: string) =>
      room && id === room.id ? room : null,
  } as Partial<RoomsRepository> as RoomsRepository;
  const canvases = new CanvasesService(
    repository,
    rooms,
    {} as WorkspaceMembersRepository,
    new FakeLiveblocksGateway(),
    versions
  );
  return {
    canvases,
    versions,
    service: new CanvasVersionsService(canvases, versions),
  };
}

const save = (canvases: CanvasesService, text: string) =>
  canvases.saveSnapshot(alice, { canvasId: 'canvas', ...content(text) });

const agoMs = (ms: number) => new Date(Date.now() - ms);

describe('CanvasVersionsService', () => {
  it('records the first autosave, then skips one with the same content', async () => {
    const { canvases, versions } = setup();
    await save(canvases, 'Draft 1');
    await save(canvases, 'Draft 1');

    expect(versions.rows.map((row) => [row.trigger, row.markdown])).toEqual([
      ['auto', 'Draft 1'],
    ]);
  });

  it('records changed content only once the last version is 5 minutes old', async () => {
    const { canvases, versions } = setup();
    const draft = {
      canvasId: 'canvas',
      organizationId: 'org',
      authorId: 'alice',
      label: null,
      trigger: 'auto',
    } as const;
    versions.add(
      { ...draft, ...content('Draft 1') },
      agoMs(AUTO_VERSION_INTERVAL_MS - 1000)
    );

    await save(canvases, 'Draft 2');
    expect(versions.rows).toHaveLength(1);

    versions.rows[0]!.createdAt = agoMs(AUTO_VERSION_INTERVAL_MS);
    await save(canvases, 'Draft 2');
    expect(versions.rows.map((row) => row.markdown)).toEqual([
      'Draft 1',
      'Draft 2',
    ]);
  });

  it('checkpoints single-user edits that change the content', async () => {
    const { canvases, versions } = setup();
    await canvases.update(alice, { canvasId: 'canvas', title: 'Renamed' });
    expect(versions.rows).toHaveLength(0);

    await canvases.update(alice, { canvasId: 'canvas', ...content('Hello') });
    expect(versions.rows.map((row) => row.trigger)).toEqual(['auto']);
  });

  it('saves a named version at any time', async () => {
    const { canvases, versions, service } = setup();
    await save(canvases, 'Draft 1');

    const saved = await service.create(alice, {
      canvasId: 'canvas',
      label: 'v1 spec',
      ...content('Draft 1'),
    });

    expect(saved).toMatchObject({
      trigger: 'manual',
      label: 'v1 spec',
      author: { id: 'alice' },
    });
    expect(versions.rows).toHaveLength(2);
  });

  it('keeps the current content as a safety version before restoring', async () => {
    const { service, versions } = setup();
    const v1 = await service.create(alice, {
      canvasId: 'canvas',
      label: 'v1',
      ...content('Draft 1'),
    });
    const current = content('Draft 2');

    const result = await service.restore(alice, {
      canvasId: 'canvas',
      versionId: v1.id,
      currentSnapshotJson: current.snapshotJson,
      currentMarkdown: current.markdown,
    });

    expect(result.safetyVersion).toMatchObject({
      trigger: 'restore',
      label: SAFETY_VERSION_LABEL,
    });
    expect(result.restoredVersion).toMatchObject({
      trigger: 'restore',
      label: 'Restored from “v1”',
    });
    expect(versions.rows.map((row) => row.markdown)).toEqual([
      'Draft 1',
      'Draft 2',
      'Draft 1',
    ]);
    expect(versions.restored).toEqual([
      { canvasId: 'canvas', markdown: 'Draft 1' },
    ]);
    expect(result.canvas).toMatchObject({
      id: 'canvas',
      access: { edit: true },
    });
  });

  it('skips the safety version when the newest version already holds the content', async () => {
    const { service } = setup();
    const v1 = await service.create(alice, {
      canvasId: 'canvas',
      ...content('Draft 1'),
    });
    const v2 = await service.create(alice, {
      canvasId: 'canvas',
      ...content('Draft 2'),
    });
    const current = content('Draft 2');

    const result = await service.restore(alice, {
      canvasId: 'canvas',
      versionId: v1.id,
      currentSnapshotJson: current.snapshotJson,
      currentMarkdown: current.markdown,
    });

    expect(result.safetyVersion).toBeNull();
    expect(v2.id).not.toBe(result.restoredVersion.id);
  });

  it('pages newest first without skipping versions saved at the same moment', async () => {
    const { service, versions } = setup();
    const at = new Date('2026-11-24T10:00:00Z');
    const base = {
      canvasId: 'canvas',
      organizationId: 'org',
      authorId: 'alice',
      label: null,
      trigger: 'manual',
    } as const;
    for (const text of ['a', 'b', 'c', 'd', 'e']) {
      versions.add({ ...base, ...content(text) }, at);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.list(carol, {
        canvasId: 'canvas',
        cursor,
        limit: 2,
      });
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual(versions.rows.map((row) => row.id).reverse());
  });

  it('lets a viewer browse versions but not save or restore them', async () => {
    const { service } = setup();
    const v1 = await service.create(alice, {
      canvasId: 'canvas',
      ...content('Draft 1'),
    });

    expect(
      (await service.list(carol, { canvasId: 'canvas', limit: 50 })).items
    ).toHaveLength(1);
    expect(
      await service.get(carol, { canvasId: 'canvas', versionId: v1.id })
    ).toMatchObject({ markdown: 'Draft 1' });
    await expect(
      service.create(carol, { canvasId: 'canvas', ...content('x') })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.restore(carol, { canvasId: 'canvas', versionId: v1.id })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('hides versions from someone the canvas is not shared with', async () => {
    const { service } = setup();
    const v1 = await service.create(alice, {
      canvasId: 'canvas',
      ...content('Draft 1'),
    });

    await expect(
      service.list(dave, { canvasId: 'canvas', limit: 50 })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.get(dave, { canvasId: 'canvas', versionId: v1.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps an archived channel canvas history readable but closed', async () => {
    const { service, versions } = setup(archived);
    const old = versions.add({
      canvasId: 'canvas',
      organizationId: 'org',
      authorId: 'alice',
      label: null,
      trigger: 'auto',
      ...content('Draft 1'),
    });

    expect(
      (await service.list(alice, { canvasId: 'canvas', limit: 50 })).items
    ).toHaveLength(1);
    await expect(
      service.create(alice, { canvasId: 'canvas', ...content('x') })
    ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });
    await expect(
      service.restore(alice, { canvasId: 'canvas', versionId: old.id })
    ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });
  });

  it('refuses a version of another canvas', async () => {
    const { service } = setup();
    await expect(
      service.get(alice, { canvasId: 'canvas', versionId: 'missing' })
    ).rejects.toMatchObject({ code: 'VERSION_NOT_FOUND' });
  });
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)(
  'CanvasVersionsService with Postgres',
  () => {
    const versions = new PrismaCanvasVersionsRepository(prisma);
    const canvases = new CanvasesService(
      new PrismaCanvasesRepository(prisma),
      new PrismaRoomsRepository(prisma),
      new PrismaWorkspaceMembersRepository(prisma),
      new FakeLiveblocksGateway(),
      versions
    );
    const service = new CanvasVersionsService(canvases, versions);
    const run = crypto.randomUUID();
    const users = {
      owner: `${run}-owner`,
      viewer: `${run}-viewer`,
      outsider: `${run}-outsider`,
    };
    const scope = (userId: string): CanvasViewerScope => ({
      userId,
      organizationId: run,
      workspaceRole: 'member',
    });
    const owner = scope(users.owner);
    const viewer = scope(users.viewer);
    const outsider = scope(users.outsider);

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
    });

    afterAll(async () => {
      await prisma.organization.deleteMany({ where: { id: run } });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(users) } },
      });
      await prisma.$disconnect();
    });

    async function sharedCanvas() {
      const canvas = await canvases.create(owner, {});
      await canvases.share(owner, {
        canvasId: canvas.id,
        userIds: [users.viewer],
        role: 'viewer',
      });
      return canvas;
    }

    it('dedupes autosaves by hash and throttles them to one per 5 minutes', async () => {
      const canvas = await sharedCanvas();
      const snapshot = (text: string) => ({
        canvasId: canvas.id,
        ...content(text),
      });

      await canvases.saveSnapshot(owner, snapshot('Draft 1'));
      await canvases.saveSnapshot(owner, snapshot('Draft 1'));
      await canvases.saveSnapshot(owner, snapshot('Draft 2'));
      expect(
        await prisma.canvasVersion.count({ where: { canvasId: canvas.id } })
      ).toBe(1);

      await prisma.canvasVersion.updateMany({
        where: { canvasId: canvas.id },
        data: { createdAt: agoMs(AUTO_VERSION_INTERVAL_MS + 1000) },
      });
      await canvases.saveSnapshot(owner, snapshot('Draft 3'));
      expect(
        (
          await service.list(viewer, { canvasId: canvas.id, limit: 50 })
        ).items.map((item) => item.trigger)
      ).toEqual(['auto', 'auto']);
    });

    it('records a named version past the interval and restores with a safety version', async () => {
      const canvas = await sharedCanvas();
      await canvases.saveSnapshot(owner, {
        canvasId: canvas.id,
        ...content('Draft 1'),
      });
      const named = await service.create(owner, {
        canvasId: canvas.id,
        label: 'v1 spec',
        ...content('Draft 1'),
      });
      const current = content('Draft 2');

      const result = await service.restore(owner, {
        canvasId: canvas.id,
        versionId: named.id,
        currentSnapshotJson: current.snapshotJson,
        currentMarkdown: current.markdown,
      });

      expect(result.canvas).toMatchObject({
        markdown: 'Draft 1',
        snapshotJson: content('Draft 1').snapshotJson,
      });
      expect(result.safetyVersion).toMatchObject({
        label: SAFETY_VERSION_LABEL,
        trigger: 'restore',
      });
      expect(
        await prisma.canvas.findUnique({
          where: { id: canvas.id },
          select: { contentHash: true, updatedById: true },
        })
      ).toEqual({
        contentHash: content('Draft 1').contentHash,
        updatedById: users.owner,
      });
      const listed = await service.list(viewer, {
        canvasId: canvas.id,
        limit: 50,
      });
      expect(listed.items.map((item) => [item.trigger, item.label])).toEqual([
        ['restore', 'Restored from “v1 spec”'],
        ['restore', SAFETY_VERSION_LABEL],
        ['manual', 'v1 spec'],
        ['auto', null],
      ]);
      expect(
        (
          await service.get(viewer, {
            canvasId: canvas.id,
            versionId: result.safetyVersion!.id,
          })
        ).markdown
      ).toBe('Draft 2');
    });

    it('pages versions that share a timestamp without gaps or repeats', async () => {
      const canvas = await sharedCanvas();
      const at = new Date('2026-11-24T10:00:00Z');
      await prisma.canvasVersion.createMany({
        data: ['a', 'b', 'c', 'd', 'e'].map((text) => ({
          canvasId: canvas.id,
          organizationId: run,
          trigger: 'MANUAL' as const,
          createdAt: at,
          ...content(text),
        })),
      });

      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await service.list(viewer, {
          canvasId: canvas.id,
          cursor,
          limit: 2,
        });
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);

      const ids = await prisma.canvasVersion.findMany({
        where: { canvasId: canvas.id },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      expect(seen).toEqual(ids.map((row) => row.id));
    });

    it('refuses viewers and outsiders, and removes versions with their canvas', async () => {
      const canvas = await sharedCanvas();
      const named = await service.create(owner, {
        canvasId: canvas.id,
        ...content('Draft 1'),
      });

      await expect(
        service.restore(viewer, { canvasId: canvas.id, versionId: named.id })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        service.list(outsider, { canvasId: canvas.id, limit: 50 })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      await prisma.canvas.delete({ where: { id: canvas.id } });
      expect(
        await prisma.canvasVersion.count({ where: { id: named.id } })
      ).toBe(0);
    });
  }
);
