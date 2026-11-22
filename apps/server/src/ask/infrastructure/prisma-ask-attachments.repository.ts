import { Inject, Injectable } from '@nestjs/common';

import type {
  AskAttachmentsRepository,
  NewAskAttachment,
} from '@/ask/domain/ask-attachments.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PrismaAskAttachmentsRepository implements AskAttachmentsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async create(attachment: NewAskAttachment) {
    await this.db.askAttachment.create({ data: attachment });
  }

  find(id: string) {
    return this.db.askAttachment.findUnique({ where: { id } });
  }

  markReady(
    id: string,
    dimensions: { width: number | null; height: number | null }
  ) {
    return this.db.askAttachment.update({
      where: { id },
      data: { ...dimensions, ready: true },
    });
  }

  async unsent(organizationId: string, ownerId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.db.askAttachment.findMany({
      where: {
        id: { in: ids },
        organizationId,
        ownerId,
        ready: true,
        answerId: null,
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  sweepable(before: Date, limit: number) {
    return this.db.askAttachment.findMany({
      where: { answerId: null, createdAt: { lt: before } },
      select: { id: true, key: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async purge(ids: string[]) {
    await this.db.askAttachment.deleteMany({
      where: { id: { in: ids }, answerId: null },
    });
  }
}
