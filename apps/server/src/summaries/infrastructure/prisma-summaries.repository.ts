import type { SummaryBullet } from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  StoredSummary,
  SummariesRepository,
} from '@/summaries/domain/summaries.repository';

function toStored(row: Prisma.SummaryGetPayload<object>): StoredSummary {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requesterId: row.requesterId,
    channelId: row.channelId,
    parentId: row.parentId,
    from: row.from,
    to: row.to,
    messageCount: row.messageCount,
    bullets: row.bullets as SummaryBullet[],
    sourceMessageIds: row.sourceMessageIds,
    sharedMessageId: row.sharedMessageId,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaSummariesRepository implements SummariesRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async create(input: Parameters<SummariesRepository['create']>[0]) {
    return toStored(await this.db.summary.create({ data: input }));
  }

  async find(summaryId: string) {
    const row = await this.db.summary.findUnique({ where: { id: summaryId } });
    return row && toStored(row);
  }

  async setShared(summaryId: string, messageId: string) {
    return toStored(
      await this.db.summary.update({
        where: { id: summaryId },
        data: { sharedMessageId: messageId },
      })
    );
  }

  async userNames(userIds: string[]) {
    const users = await this.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }
}
