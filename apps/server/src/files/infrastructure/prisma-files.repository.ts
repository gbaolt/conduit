import {
  contentTypesOf,
  FILE_KINDS,
  type FileCounts,
  type FileKind,
  fileKind,
  type ListedFile,
  PREVIEWABLE_CONTENT_TYPES,
  TEXT_CONTENT_PREFIX,
  TEXT_CONTENT_TYPES,
} from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import type {
  FileFilterQuery,
  FileListQuery,
  FilesRepository,
  NewFile,
  StoredFile,
} from '@/files/domain/files.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

type FileRow = Prisma.FileGetPayload<object>;

export function toStoredFile(row: FileRow): StoredFile {
  return {
    id: row.id,
    organizationId: row.organizationId,
    uploaderId: row.uploaderId,
    roomId: row.roomId,
    messageId: row.messageId,
    name: row.name,
    contentType: row.contentType,
    size: row.size,
    width: row.width,
    height: row.height,
    key: row.key,
    status: row.status === 'READY' ? 'ready' : 'pending',
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    sourceFileId: row.sourceFileId,
  };
}

const TEXT: Prisma.FileWhereInput = {
  OR: [
    { contentType: { startsWith: TEXT_CONTENT_PREFIX } },
    { contentType: { in: TEXT_CONTENT_TYPES } },
  ],
};

function ofKind(kind: FileKind): Prisma.FileWhereInput {
  if (kind === 'text') return TEXT;
  if (kind === 'other') {
    return {
      contentType: { notIn: PREVIEWABLE_CONTENT_TYPES },
      NOT: TEXT,
    };
  }
  return { contentType: { in: contentTypesOf(kind) } };
}

function ofKinds(kinds: FileListQuery['kinds']): Prisma.FileWhereInput {
  return kinds?.length ? { OR: kinds.map(ofKind) } : {};
}

/** Sent, unremoved files the filters keep. */
function filtered(query: FileFilterQuery): Prisma.FileWhereInput {
  return {
    organizationId: query.organizationId,
    roomId: { in: query.roomIds },
    status: 'READY',
    deletedAt: null,
    messageId: { not: null },
    ...((query.uploaderId || query.notUploaderId) && {
      uploaderId: {
        ...(query.uploaderId && { equals: query.uploaderId }),
        ...(query.notUploaderId && { not: query.notUploaderId }),
      },
    }),
    ...(query.name && {
      name: { contains: query.name, mode: 'insensitive' as const },
    }),
    ...(query.roomKind && { room: { kind: 'CHANNEL' as const } }),
  };
}

/** File rows. Returns domain types, so no Prisma row leaves this file. */
@Injectable()
export class PrismaFilesRepository implements FilesRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async createPending(file: NewFile, cap: number) {
    return this.db.$transaction(async (tx) => {
      // One lock per workspace for the rest of the transaction, so a second upload reads the sum after this insert.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`files:${file.organizationId}`}, 0))`;
      const {
        _sum: { size },
      } = await tx.file.aggregate({
        where: { organizationId: file.organizationId, deletedAt: null },
        _sum: { size: true },
      });
      const used = size ?? 0;
      if (used + file.size > cap) {
        return { created: false as const, used };
      }
      await tx.file.create({ data: file });
      return { created: true as const };
    });
  }

  async find(fileId: string) {
    const row = await this.db.file.findUnique({ where: { id: fileId } });
    return row && toStoredFile(row);
  }

  async findMany(fileIds: string[]) {
    const rows = await this.db.file.findMany({
      where: { id: { in: fileIds } },
    });
    return rows.map(toStoredFile);
  }

  async markReady(
    fileId: string,
    dimensions: { width: number | null; height: number | null }
  ) {
    await this.db.file.updateMany({
      where: { id: fileId, status: 'PENDING' },
      data: { status: 'READY', ...dimensions },
    });
    return toStoredFile(
      await this.db.file.findUniqueOrThrow({ where: { id: fileId } })
    );
  }

  async cancel(fileId: string) {
    await this.db.file.updateMany({
      where: { id: fileId, messageId: null, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async list(query: FileListQuery) {
    const cursor = query.before
      ? await this.db.file.findFirst({
          where: { id: query.before, organizationId: query.organizationId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.before && !cursor) return { files: [], hasMore: false };

    const rows = await this.db.file.findMany({
      where: {
        ...filtered(query),
        AND: [
          ofKinds(query.kinds),
          cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {},
        ],
      },
      include: {
        room: {
          select: { id: true, name: true, kind: true, visibility: true },
        },
        uploader: { select: { id: true, name: true, image: true } },
        message: { select: { id: true, parentId: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const files = rows.slice(0, query.limit).flatMap((row): ListedFile[] =>
      row.message
        ? [
            {
              id: row.id,
              name: row.name,
              contentType: row.contentType,
              size: row.size,
              width: row.width,
              height: row.height,
              messageId: row.message.id,
              parentId: row.message.parentId,
              room: {
                id: row.room.id,
                // A DM stores its key in `name`, and shows no name.
                name: row.room.kind === 'DM' ? '' : row.room.name,
                kind: row.room.kind === 'DM' ? 'dm' : 'channel',
                visibility:
                  row.room.kind === 'DM' || row.room.visibility === 'PRIVATE'
                    ? 'private'
                    : 'public',
              },
              uploader: row.uploader,
              createdAt: row.createdAt,
            },
          ]
        : []
    );
    return { files, hasMore: rows.length > query.limit };
  }

  async counts(query: FileFilterQuery) {
    const groups = await this.db.file.groupBy({
      by: ['contentType'],
      where: filtered(query),
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      FILE_KINDS.map((kind) => [kind, 0])
    ) as FileCounts;
    for (const group of groups) {
      counts[fileKind(group.contentType)] += group._count._all;
    }
    return counts;
  }

  async sweepable(pendingBefore: Date, limit: number) {
    const rows = await this.db.file.findMany({
      where: {
        OR: [
          { status: 'PENDING', createdAt: { lt: pendingBefore } },
          { deletedAt: { not: null } },
        ],
      },
      select: { id: true, key: true },
      take: limit,
    });
    // A file still waiting on the drain keeps its row, which knows how many documents to delete.
    const waiting = await this.db.searchSync.findMany({
      where: { kind: 'FILE', targetId: { in: rows.map((row) => row.id) } },
      select: { targetId: true },
    });
    const held = new Set(waiting.map((row) => row.targetId));
    return rows.filter((row) => !held.has(row.id));
  }

  async purge(fileIds: string[]) {
    await this.db.file.deleteMany({ where: { id: { in: fileIds } } });
  }
}
