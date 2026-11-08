import { Inject, Injectable } from '@nestjs/common';

import type {
  ActivityRepository,
  ConversationScope,
} from '@/activity/domain/activity.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const keyOf = ({ roomId, userId, parentId }: ConversationScope) => ({
  roomId_userId_parentId: { roomId, userId, parentId },
});

@Injectable()
export class PrismaActivityRepository implements ActivityRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async markRead({
    roomId,
    userId,
    messageId,
  }: {
    roomId: string;
    userId: string;
    messageId: string;
  }) {
    const message = await this.db.message.findUnique({
      where: { id: messageId },
      select: { roomId: true, createdAt: true },
    });
    if (message?.roomId !== roomId) {
      return false;
    }

    // The guarded update only moves forward. It matches nothing when the row is missing or already past
    // the message, and then the insert covers the missing row. The second update catches a row that
    // a concurrent call inserted just behind this message.
    const advance = () =>
      this.db.readState.updateMany({
        where: { roomId, userId, lastReadAt: { lt: message.createdAt } },
        data: { lastReadAt: message.createdAt, lastReadMessageId: messageId },
      });

    if ((await advance()).count === 0) {
      const inserted = await this.db.readState.createMany({
        data: [
          {
            roomId,
            userId,
            lastReadAt: message.createdAt,
            lastReadMessageId: messageId,
          },
        ],
        skipDuplicates: true,
      });
      if (inserted.count === 0) {
        await advance();
      }
    }
    return true;
  }

  async getDraft(scope: ConversationScope) {
    const draft = await this.db.draft.findUnique({
      where: keyOf(scope),
      select: { body: true },
    });
    return draft?.body ?? '';
  }

  async saveDraft(scope: ConversationScope, body: string) {
    if (body === '') {
      await this.db.draft.deleteMany({ where: scope });
      return;
    }
    await this.db.draft.upsert({
      where: keyOf(scope),
      create: { ...scope, body },
      update: { body },
    });
  }

  async setTyping(scope: ConversationScope, until: Date) {
    await this.db.typingState.upsert({
      where: keyOf(scope),
      create: { ...scope, until },
      update: { until },
    });
  }

  async recordHeartbeat({
    organizationId,
    userId,
    away,
    at,
  }: {
    organizationId: string;
    userId: string;
    away: boolean;
    at: Date;
  }) {
    await this.db.presence.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId, lastActiveAt: at, away },
      update: { lastActiveAt: at, away },
    });
  }
}
