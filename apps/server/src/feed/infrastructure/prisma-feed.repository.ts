import type { ActivityUrgency, FeedEntry, FeedFilter } from '@conduit/contract';
import { ONLINE_WINDOW_MS } from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import type {
  FeedRepository,
  UnrankedItem,
} from '@/feed/domain/feed.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

import {
  fromPrismaKind,
  fromPrismaUrgency,
  PRISMA_URGENCY,
} from './activity-items';

/** An item in a room the caller left stays in the table but is hidden, as in the `feed` stream. */
const stillIn = (userId: string) =>
  ({
    room: { members: { some: { userId } } },
  }) satisfies Prisma.ActivityItemWhereInput;

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

  async list(input: {
    userId: string;
    organizationId: string;
    filter: FeedFilter;
    before?: string;
    limit: number;
  }) {
    const cursor = input.before
      ? await this.db.activityItem.findFirst({
          where: { id: input.before, userId: input.userId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (input.before && !cursor) return null;

    const rows = await this.db.activityItem.findMany({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
        ...stillIn(input.userId),
        ...(input.filter === 'unread' && { readAt: null }),
        ...(cursor && {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }),
      },
      include: {
        room: { select: { id: true, name: true, kind: true } },
        actor: { select: { id: true, name: true, image: true } },
        message: {
          select: { id: true, parentId: true, body: true, deletedAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });

    const entries = rows.slice(0, input.limit).map(
      (row): FeedEntry => ({
        id: row.id,
        kind: fromPrismaKind(row.kind),
        room: {
          id: row.room.id,
          // A DM stores its key in `name`, and shows no name.
          name: row.room.kind === 'DM' ? '' : row.room.name,
          kind: row.room.kind === 'DM' ? 'dm' : 'channel',
        },
        actor: row.actor,
        message: row.message ?? undefined,
        emoji: row.emoji ?? undefined,
        urgency: row.urgency ? fromPrismaUrgency(row.urgency) : undefined,
        urgencyReason: row.urgencyReason ?? undefined,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })
    );
    return { entries, hasMore: rows.length > input.limit };
  }

  async markRead(userId: string, ids: string[]) {
    await this.db.activityItem.updateMany({
      where: { userId, id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string, organizationId: string) {
    await this.db.activityItem.updateMany({
      where: { userId, organizationId, readAt: null, ...stillIn(userId) },
      data: { readAt: new Date() },
    });
  }

  async markReadThroughPosition({
    roomId,
    userId,
  }: {
    roomId: string;
    userId: string;
  }) {
    const position = await this.db.readState.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { lastReadAt: true },
    });
    if (!position) return;

    await this.db.activityItem.updateMany({
      where: {
        userId,
        roomId,
        kind: 'MENTION',
        readAt: null,
        // The conversation shows top-level messages and replies sent to the channel, not other thread replies.
        message: {
          createdAt: { lte: position.lastReadAt },
          OR: [{ parentId: null }, { alsoSentToChannel: true }],
        },
      },
      data: { readAt: new Date() },
    });
  }

  async unranked(input: {
    userId: string;
    organizationId: string;
    limit: number;
  }) {
    const rows = await this.db.activityItem.findMany({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
        ...stillIn(input.userId),
        kind: { in: ['MENTION', 'THREAD_REPLY'] },
        readAt: null,
        urgency: null,
        message: { deletedAt: null },
      },
      select: {
        id: true,
        kind: true,
        actorId: true,
        message: {
          select: { body: true, mentionedUserIds: true, createdAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
    });

    return rows.flatMap(({ message, ...row }): UnrankedItem[] =>
      message
        ? [
            {
              id: row.id,
              kind: row.kind === 'MENTION' ? 'mention' : 'thread_reply',
              actorId: row.actorId,
              body: message.body,
              mentionedUserIds: message.mentionedUserIds,
              sentAt: message.createdAt,
            },
          ]
        : []
    );
  }

  async setUrgency(
    userId: string,
    ratings: { id: string; urgency: ActivityUrgency; reason: string }[]
  ) {
    await this.db.$transaction(
      ratings.map(({ id, urgency, reason }) =>
        this.db.activityItem.updateMany({
          where: { id, userId },
          data: { urgency: PRISMA_URGENCY[urgency], urgencyReason: reason },
        })
      )
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
