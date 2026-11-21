import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  SearchSyncKind,
  SearchSyncRepository,
  SearchSyncRow,
} from '@/search/domain/search-sync.repository';

const ERROR_MAX = 500;

type ClaimedRow = Omit<SearchSyncRow, 'kind'> & { kind: 'MESSAGE' | 'FILE' };

/** Sync rows, and the message and file state the drain reads. Returns domain types, so no Prisma row leaves this file. */
@Injectable()
export class PrismaSearchSyncRepository implements SearchSyncRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async claim({
    organizationId,
    limit,
    leaseMs,
  }: {
    organizationId?: string;
    limit: number;
    leaseMs: number;
  }) {
    const scope = organizationId
      ? Prisma.sql`AND "organizationId" = ${organizationId}`
      : Prisma.empty;
    const rows = await this.db.$queryRaw<ClaimedRow[]>`
      UPDATE "SearchSync" s SET "dueAt" = now() + ${leaseMs} * interval '1 millisecond'
      FROM (
        SELECT "kind", "targetId" FROM "SearchSync"
        WHERE "dueAt" <= now() ${scope}
        ORDER BY "dueAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) due
      WHERE s."kind" = due."kind" AND s."targetId" = due."targetId"
      RETURNING s."kind", s."targetId", s."organizationId", s."dueAt", s."attempts"`;
    return rows.map(
      (row): SearchSyncRow => ({
        ...row,
        kind: row.kind.toLowerCase() as SearchSyncKind,
      })
    );
  }

  /** Matches the row only while it still holds the lease it was claimed with. */
  private leased(row: SearchSyncRow) {
    return {
      kind: row.kind === 'message' ? ('MESSAGE' as const) : ('FILE' as const),
      targetId: row.targetId,
      dueAt: row.dueAt,
    };
  }

  async finish(row: SearchSyncRow) {
    await this.db.searchSync.deleteMany({ where: this.leased(row) });
  }

  async fail(row: SearchSyncRow, error: string, retryMs: number) {
    const { kind, targetId, dueAt } = this.leased(row);
    await this.db.$executeRaw`
      UPDATE "SearchSync"
      SET "attempts" = "attempts" + 1, "lastError" = ${error.slice(0, ERROR_MAX)},
        "dueAt" = now() + ${retryMs} * interval '1 millisecond'
      WHERE "kind" = ${kind}::"SearchSyncKind" AND "targetId" = ${targetId} AND "dueAt" = ${dueAt}`;
  }

  async message(messageId: string) {
    const row = await this.db.message.findFirst({
      where: { id: messageId, deletedAt: null },
    });
    if (!row) return null;
    const mentioned = await this.db.user.findMany({
      where: { id: { in: row.mentionedUserIds } },
      select: { id: true, name: true },
    });
    return {
      id: row.id,
      roomId: row.roomId,
      authorId: row.authorId,
      parentId: row.parentId,
      body: row.body,
      hasFile: Array.isArray(row.files) && row.files.length > 0,
      createdAt: row.createdAt,
      mentionNames: Object.fromEntries(
        mentioned.map((user) => [user.id, user.name])
      ),
    };
  }

  async file(fileId: string) {
    const row = await this.db.file.findUnique({
      where: { id: fileId },
      include: { message: { select: { parentId: true, deletedAt: true } } },
    });
    if (!row) return null;
    const message = row.messageId && row.message && !row.message.deletedAt;
    const live = row.status === 'READY' && !row.deletedAt && message;
    return {
      key: row.key,
      size: row.size,
      indexedChunks: row.indexedChunks,
      source:
        live && row.messageId
          ? {
              id: row.id,
              roomId: row.roomId,
              uploaderId: row.uploaderId,
              messageId: row.messageId,
              parentId: row.message?.parentId ?? null,
              name: row.name,
              contentType: row.contentType,
              createdAt: row.createdAt,
            }
          : null,
    };
  }

  async setIndexedChunks(fileId: string, count: number) {
    await this.db.file.updateMany({
      where: { id: fileId },
      data: { indexedChunks: count },
    });
  }
}
