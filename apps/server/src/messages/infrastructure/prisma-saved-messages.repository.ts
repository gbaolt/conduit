import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { SavedMessagesRepository } from '@/messages/domain/saved-messages.repository';

import { toMessage } from './prisma-messages.repository';

/** A member's bookmarks. The primary key on `(userId, messageId)` keeps each message saved once. */
@Injectable()
export class PrismaSavedMessagesRepository implements SavedMessagesRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async add(userId: string, messageId: string) {
    await this.db.savedMessage.createMany({
      data: { userId, messageId },
      skipDuplicates: true,
    });
  }

  async remove(userId: string, messageId: string) {
    await this.db.savedMessage.deleteMany({ where: { userId, messageId } });
  }

  async list(userId: string, channelIds: string[], limit: number) {
    const rows = await this.db.savedMessage.findMany({
      where: {
        userId,
        message: { channelId: { in: channelIds }, deletedAt: null },
      },
      include: {
        message: { include: { channel: { select: { name: true } } } },
      },
      orderBy: [{ savedAt: 'desc' }, { messageId: 'desc' }],
      take: limit,
    });

    return rows.map(({ message, savedAt }) => ({
      message: toMessage(message),
      channelName: message.channel.name,
      savedAt,
    }));
  }
}
