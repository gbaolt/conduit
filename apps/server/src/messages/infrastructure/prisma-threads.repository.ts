import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { ThreadsRepository } from '@/messages/domain/threads.repository';

import { toMessage } from './prisma-messages.repository';

@Injectable()
export class PrismaThreadsRepository implements ThreadsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(
    userId: string,
    roomIds: string[],
    limit: { threads: number; replies: number }
  ) {
    const live = { deletedAt: null };
    const rows = await this.db.message.findMany({
      where: {
        roomId: { in: roomIds },
        parentId: null,
        replies: { some: live },
        OR: [
          { authorId: userId },
          { replies: { some: { ...live, authorId: userId } } },
        ],
      },
      include: {
        room: { select: { name: true, kind: true } },
        replies: {
          where: live,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit.replies,
        },
      },
      orderBy: [
        { lastReplyAt: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
      take: limit.threads,
    });

    const repliers = await this.db.message.findMany({
      where: { parentId: { in: rows.map((row) => row.id) }, ...live },
      distinct: ['parentId', 'authorId'],
      select: { parentId: true, authorId: true },
      orderBy: [{ parentId: 'asc' }, { authorId: 'asc' }],
    });

    return rows.map(({ room, replies, ...root }) => ({
      root: toMessage(root),
      // A DM stores its key in `name`, and shows no name.
      channelName: room.kind === 'DM' ? null : room.name,
      replies: replies.map(toMessage).reverse(),
      participantIds: [
        ...new Set([
          root.authorId,
          ...repliers
            .filter((reply) => reply.parentId === root.id)
            .map((reply) => reply.authorId),
        ]),
      ],
    }));
  }
}
