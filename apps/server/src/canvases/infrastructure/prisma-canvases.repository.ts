import {
  CanvasCoverPresetSchema,
  type CanvasRole,
  type CanvasScope,
  type Room,
} from '@conduit/contract';
import type {
  CanvasRole as CanvasRoleRow,
  Prisma,
  RoomKind,
} from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { canvasError } from '@/canvases/domain/canvas-errors';
import type {
  CanvasesRepository,
  CanvasPatch,
  CanvasScopeOf,
  CanvasSeed,
  CanvasSnapshot,
  StoredCanvas,
  StoredCanvasDocument,
} from '@/canvases/domain/canvases.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const toRole = (role: CanvasRoleRow): CanvasRole =>
  role === 'EDITOR' ? 'editor' : 'viewer';
const fromRole = (role: CanvasRole): CanvasRoleRow =>
  role === 'editor' ? 'EDITOR' : 'VIEWER';

function select(scope: CanvasScopeOf) {
  return {
    id: true,
    organizationId: true,
    roomId: true,
    title: true,
    icon: true,
    coverPreset: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    room: { select: { name: true, kind: true } },
    updatedBy: { select: { name: true } },
    members: { where: { userId: scope.userId }, select: { role: true } },
  } satisfies Prisma.CanvasSelect;
}

function documentSelect(scope: CanvasScopeOf) {
  return {
    ...select(scope),
    snapshotJson: true,
    markdown: true,
  } satisfies Prisma.CanvasSelect;
}

type CanvasRow = Prisma.CanvasGetPayload<{
  select: ReturnType<typeof select>;
}>;
type CanvasDocumentRow = Prisma.CanvasGetPayload<{
  select: ReturnType<typeof documentSelect>;
}>;

const toRoomKind = (kind: RoomKind): Room['kind'] =>
  kind === 'DM' ? 'dm' : 'channel';

function toCanvas(row: CanvasRow): StoredCanvas {
  const share = row.members[0];
  return {
    id: row.id,
    organizationId: row.organizationId,
    roomId: row.roomId,
    roomKind: row.room ? toRoomKind(row.room.kind) : null,
    // A DM stores its key in `name`, and shows no name.
    roomName: row.room?.kind === 'CHANNEL' ? row.room.name : null,
    title: row.title,
    icon: row.icon,
    // A preset dropped from the contract reads as no cover rather than failing the response.
    coverPreset:
      CanvasCoverPresetSchema.safeParse(row.coverPreset).data ?? null,
    createdById: row.createdById,
    updatedByName: row.updatedBy?.name ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    viewerRole: share ? toRole(share.role) : null,
  };
}

function toDocument(row: CanvasDocumentRow): StoredCanvasDocument {
  return {
    ...toCanvas(row),
    snapshotJson: row.snapshotJson as Record<string, unknown> | null,
    markdown: row.markdown,
  };
}

function stillInWorkspace(scope: CanvasScopeOf) {
  return {
    user: { members: { some: { organizationId: scope.organizationId } } },
  } satisfies Prisma.CanvasMemberWhereInput;
}

type Tx = Prisma.TransactionClient;

const seedData = (seed: CanvasSeed) => ({
  ...seed,
  snapshotJson: seed.snapshotJson as Prisma.InputJsonValue | undefined,
});

/** Canvas and canvas-member rows. Returns contract types, so no Prisma row leaves this file. */
@Injectable()
export class PrismaCanvasesRepository implements CanvasesRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async find(scope: CanvasScopeOf, canvasId: string) {
    const row = await this.db.canvas.findFirst({
      where: {
        id: canvasId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      select: documentSelect(scope),
    });
    return row && toDocument(row);
  }

  async findForLink(scope: CanvasScopeOf, canvasId: string) {
    const row = await this.db.canvas.findFirst({
      where: { id: canvasId, organizationId: scope.organizationId },
      select: { ...select(scope), markdown: true, deletedAt: true },
    });
    return (
      row && {
        ...toCanvas(row),
        markdown: row.markdown,
        deletedAt: row.deletedAt,
      }
    );
  }

  async listInChannel(scope: CanvasScopeOf, roomId: string) {
    const rows = await this.db.canvas.findMany({
      where: { roomId, organizationId: scope.organizationId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: select(scope),
    });
    return rows.map(toCanvas);
  }

  async createInChannel(
    scope: CanvasScopeOf,
    roomId: string,
    title: string,
    seed: CanvasSeed = {}
  ) {
    const row = await this.db.canvas.create({
      data: {
        ...seedData(seed),
        organizationId: scope.organizationId,
        roomId,
        title,
        createdById: scope.userId,
        updatedById: scope.userId,
      },
      select: { id: true },
    });
    return row.id;
  }

  async createStandalone(
    scope: CanvasScopeOf,
    title: string,
    seed: CanvasSeed = {}
  ) {
    const row = await this.db.canvas.create({
      data: {
        ...seedData(seed),
        organizationId: scope.organizationId,
        title,
        createdById: scope.userId,
        updatedById: scope.userId,
        members: {
          create: {
            userId: scope.userId,
            role: 'EDITOR',
            addedById: scope.userId,
          },
        },
      },
      select: { id: true },
    });
    return row.id;
  }

  async list(
    scope: CanvasScopeOf,
    roomIds: string[],
    canvasScope: CanvasScope
  ) {
    const inChannels = {
      roomId: { in: roomIds },
    } satisfies Prisma.CanvasWhereInput;
    const shared = {
      roomId: null,
      members: { some: { userId: scope.userId } },
    } satisfies Prisma.CanvasWhereInput;
    const rows = await this.db.canvas.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        OR: {
          all: [inChannels, shared],
          channel: [inChannels],
          shared: [shared],
        }[canvasScope],
      },
      select: select(scope),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      // shortcut: the newest 500 only, add a cursor once a workspace holds more.
      take: 500,
    });
    return rows.map(toCanvas);
  }

  async update(scope: CanvasScopeOf, canvasId: string, patch: CanvasPatch) {
    await this.db.canvas.update({
      where: { id: canvasId },
      data: {
        title: patch.title,
        icon: patch.icon,
        coverPreset: patch.coverPreset,
        snapshotJson: patch.snapshotJson as Prisma.InputJsonValue | undefined,
        markdown: patch.markdown,
        // A save outside `saveSnapshot` makes the stored hash stale.
        contentHash: patch.snapshotJson ? null : undefined,
        updatedById: scope.userId,
      },
    });
  }

  async claimBootstrap(canvasId: string) {
    // One conditional UPDATE, so Postgres lets exactly one of any concurrent callers through.
    const rows = await this.db.$queryRaw<
      { snapshotJson: unknown; initialMarkdown: string | null }[]
    >`
      UPDATE "Canvas" SET "seededAt" = now()
      WHERE id = ${canvasId} AND "seededAt" IS NULL AND "deletedAt" IS NULL
      RETURNING "snapshotJson", "initialMarkdown"`;
    const row = rows[0];
    if (!row) return null;
    return {
      snapshotJson:
        row.snapshotJson === null ? null : JSON.stringify(row.snapshotJson),
      initialMarkdown: row.initialMarkdown,
    };
  }

  async saveSnapshot(
    scope: CanvasScopeOf,
    canvasId: string,
    snapshot: CanvasSnapshot
  ) {
    const { count } = await this.db.canvas.updateMany({
      where: {
        id: canvasId,
        OR: [
          { contentHash: null },
          { contentHash: { not: snapshot.contentHash } },
        ],
      },
      data: {
        snapshotJson: snapshot.snapshotJson as Prisma.InputJsonValue,
        markdown: snapshot.markdown,
        contentHash: snapshot.contentHash,
        updatedById: scope.userId,
      },
    });
    const { updatedAt } = await this.db.canvas.findUniqueOrThrow({
      where: { id: canvasId },
      select: { updatedAt: true },
    });
    return { saved: count > 0, updatedAt };
  }

  async softDelete(canvasId: string) {
    await this.db.canvas.update({
      where: { id: canvasId },
      data: { deletedAt: new Date() },
    });
  }

  async listMembers(scope: CanvasScopeOf, canvasId: string) {
    const rows = await this.db.canvasMember.findMany({
      where: { canvasId, ...stillInWorkspace(scope) },
      include: { user: { select: { name: true, email: true, image: true } } },
      // EDITOR is declared first in the enum, so editors sort first.
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image,
      role: toRole(row.role),
      addedAt: row.createdAt,
    }));
  }

  /** Runs `write`, then refuses with `LAST_EDITOR` if no current workspace member is left editing. */
  private async keepingAnEditor(
    scope: CanvasScopeOf,
    canvasId: string,
    write: (tx: Tx) => Promise<unknown>
  ) {
    await this.db.$transaction(async (tx) => {
      // Locking the canvas row serializes share changes, so two at once cannot both see another editor.
      await tx.$queryRaw`SELECT id FROM "Canvas" WHERE id = ${canvasId} FOR UPDATE`;
      await write(tx);
      const editors = await tx.canvasMember.count({
        where: { canvasId, role: 'EDITOR', ...stillInWorkspace(scope) },
      });
      if (editors === 0) throw canvasError('LAST_EDITOR');
    });
  }

  async share(
    scope: CanvasScopeOf,
    canvasId: string,
    userIds: string[],
    role: CanvasRole
  ) {
    await this.keepingAnEditor(scope, canvasId, async (tx) => {
      await tx.canvasMember.createMany({
        data: userIds.map((userId) => ({
          canvasId,
          userId,
          role: fromRole(role),
          addedById: scope.userId,
        })),
        skipDuplicates: true,
      });
      await tx.canvasMember.updateMany({
        where: { canvasId, userId: { in: userIds } },
        data: { role: fromRole(role) },
      });
    });
  }

  async setMemberRole(
    scope: CanvasScopeOf,
    canvasId: string,
    userId: string,
    role: CanvasRole
  ) {
    await this.keepingAnEditor(scope, canvasId, (tx) =>
      tx.canvasMember.updateMany({
        where: { canvasId, userId },
        data: { role: fromRole(role) },
      })
    );
  }

  async removeMember(scope: CanvasScopeOf, canvasId: string, userId: string) {
    await this.keepingAnEditor(scope, canvasId, (tx) =>
      tx.canvasMember.deleteMany({ where: { canvasId, userId } })
    );
  }

  async findMessages(organizationId: string, messageIds: string[]) {
    const rows = await this.db.message.findMany({
      where: { id: { in: messageIds }, room: { organizationId } },
      select: {
        id: true,
        parentId: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        room: { select: { id: true, name: true, kind: true } },
        author: { select: { id: true, name: true, image: true } },
      },
    });
    return rows.map(({ deletedAt, room, ...message }) => ({
      deletedAt,
      message: {
        ...message,
        // A DM stores its key in `name`, and shows no name.
        room: {
          id: room.id,
          name: room.kind === 'DM' ? '' : room.name,
          kind: toRoomKind(room.kind),
        },
      },
    }));
  }

  async userNames(userIds: string[]) {
    const users = await this.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }

  async workspaceUserNames(organizationId: string, userIds: string[]) {
    const users = await this.db.user.findMany({
      where: {
        id: { in: userIds },
        members: { some: { organizationId, deactivation: null } },
      },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }
}
