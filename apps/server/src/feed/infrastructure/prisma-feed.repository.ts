import { ONLINE_WINDOW_MS } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import type { FeedRepository } from '@/feed/domain/feed.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PrismaFeedRepository implements FeedRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async recipientLookup(input: {
    organizationId: string;
    roomId: string;
    parentId?: string;
    here: boolean;
    now: Date;
  }) {
    const [members, online, replies] = await Promise.all([
      this.db.roomMember.findMany({
        where: {
          roomId: input.roomId,
          user: { members: { some: { organizationId: input.organizationId } } },
        },
        select: { userId: true },
      }),
      input.here
        ? this.db.presence.findMany({
            where: {
              organizationId: input.organizationId,
              away: false,
              lastActiveAt: {
                gt: new Date(input.now.getTime() - ONLINE_WINDOW_MS),
              },
            },
            select: { userId: true },
          })
        : [],
      input.parentId
        ? this.db.message.findMany({
            where: { parentId: input.parentId, deletedAt: null },
            select: { authorId: true },
            distinct: ['authorId'],
          })
        : [],
    ]);

    return {
      memberIds: members.map((row) => row.userId),
      onlineIds: online.map((row) => row.userId),
      repliers: replies.map((row) => row.authorId),
    };
  }
}
