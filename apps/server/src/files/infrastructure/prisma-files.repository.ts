import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import type {
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
}
