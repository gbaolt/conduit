import type { CanvasRole, CanvasScope } from '@conduit/contract';
import {
  type CanvasRole as CanvasRoleRow,
  Prisma,
} from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { canvasError } from '@/canvases/domain/canvas-errors';
import type {
  CanvasesRepository,
  CanvasPatch,
  CanvasScopeOf,
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
    isChannelPrimary: true,
    title: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    room: { select: { name: true } },
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

function toCanvas(row: CanvasRow): StoredCanvas {
  const share = row.members[0];
  return {
    id: row.id,
    organizationId: row.organizationId,
    roomId: row.roomId,
    roomName: row.room?.name ?? null,
    isChannelPrimary: row.isChannelPrimary,
    title: row.title,
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

  async findChannelPrimary(scope: CanvasScopeOf, roomId: string) {
    const row = await this.db.canvas.findFirst({
      where: {
        roomId,
        organizationId: scope.organizationId,
        isChannelPrimary: true,
        deletedAt: null,
      },
      select: documentSelect(scope),
    });
    return row && toDocument(row);
  }

  async createChannelPrimary(
    scope: CanvasScopeOf,
    roomId: string,
    title: string
  ) {
    try {
      const row = await this.db.canvas.create({
        data: {
          organizationId: scope.organizationId,
          roomId,
          isChannelPrimary: true,
          title,
          createdById: scope.userId,
          updatedById: scope.userId,
        },
        select: { id: true },
      });
      return row.id;
    } catch (error) {
      // The partial unique index lets one live primary canvas per channel, so the loser of a race opens the winner's.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.findChannelPrimary(scope, roomId);
        if (winner) return winner.id;
      }
      throw error;
    }
  }

  async createStandalone(scope: CanvasScopeOf, title: string) {
    const row = await this.db.canvas.create({
      data: {
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
          kind: room.kind === 'DM' ? ('dm' as const) : ('channel' as const),
        },
      },
    }));
  }
}
