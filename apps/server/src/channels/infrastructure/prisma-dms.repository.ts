import type { Dm } from '@conduit/contract';
import { DM_MEMBERS_MAX } from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { channelError, dmError } from '@/channels/domain/channel-errors';
import type { ChannelScope } from '@/channels/domain/channels.repository';
import { dmKey } from '@/channels/domain/dm-key';
import type { DmsRepository } from '@/channels/domain/dms.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

import {
  include,
  rethrowNameTaken,
  toChannel,
} from './prisma-channels.repository';

const dmInclude = {
  members: {
    select: {
      userId: true,
      user: { select: { name: true, image: true } },
    },
    orderBy: { joinedAt: 'asc' },
  },
} satisfies Prisma.ChannelInclude;

type DmRow = Prisma.ChannelGetPayload<{ include: typeof dmInclude }>;

function toDm(row: DmRow): Dm {
  return {
    id: row.id,
    members: row.members.map(({ userId, user }) => ({
      userId,
      name: user.name,
      image: user.image,
    })),
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
  };
}

/** DM rows. A DM keeps its key in `name` too, since `(organizationId, name)` is unique and a DM has no name. */
@Injectable()
export class PrismaDmsRepository implements DmsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(scope: ChannelScope) {
    const rows = await this.db.channel.findMany({
      where: {
        organizationId: scope.organizationId,
        kind: 'DM',
        members: { some: { userId: scope.userId } },
      },
      include: dmInclude,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
    return rows.map(toDm);
  }

  async open(scope: ChannelScope, userIds: string[]) {
    const key = dmKey(scope.organizationId, userIds);

    // Both writes skip rows that exist, so two opens at once, or a retry, converge on one DM.
    await this.db.channel.createMany({
      data: {
        organizationId: scope.organizationId,
        name: key,
        dmKey: key,
        kind: 'DM',
        visibility: 'PRIVATE',
        createdById: scope.userId,
      },
      skipDuplicates: true,
    });
    const { id } = await this.db.channel.findUniqueOrThrow({
      where: { dmKey: key },
      select: { id: true },
    });
    // Also restores someone whose memberships a workspace removal deleted.
    await this.db.channelMember.createMany({
      data: userIds.map((userId) => ({ channelId: id, userId })),
      skipDuplicates: true,
    });

    return toDm(
      await this.db.channel.findUniqueOrThrow({
        where: { id },
        include: dmInclude,
      })
    );
  }

  async addPeople(scope: ChannelScope, channelId: string, userIds: string[]) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Channel" WHERE id = ${channelId} FOR UPDATE`;
      const current = await tx.channelMember.findMany({
        where: { channelId },
        select: { userId: true },
      });
      const everyone = [
        ...new Set([...current.map((member) => member.userId), ...userIds]),
      ];

      if (everyone.length > DM_MEMBERS_MAX) {
        throw dmError('DM_FULL');
      }
      if (everyone.length > current.length) {
        const key = dmKey(scope.organizationId, everyone);
        await tx.channel
          .update({ where: { id: channelId }, data: { dmKey: key, name: key } })
          .catch((error: unknown) => {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              throw dmError('DM_EXISTS');
            }
            throw error;
          });
        await tx.channelMember.createMany({
          data: everyone.map((userId) => ({ channelId, userId })),
          skipDuplicates: true,
        });
      }

      return toDm(
        await tx.channel.findUniqueOrThrow({
          where: { id: channelId },
          include: dmInclude,
        })
      );
    });
  }

  async convertToChannel(scope: ChannelScope, channelId: string, name: string) {
    return this.db.$transaction(async (tx) => {
      // Matching on `kind` makes a second conversion at once find nothing.
      const { count } = await tx.channel
        .updateMany({
          where: { id: channelId, kind: 'DM' },
          data: { kind: 'CHANNEL', visibility: 'PRIVATE', name, dmKey: null },
        })
        .catch(rethrowNameTaken);
      if (count === 0) {
        throw channelError('NOT_FOUND');
      }
      // A private channel needs a manager, and a DM has none.
      await tx.channelMember.updateMany({
        where: { channelId, userId: scope.userId },
        data: { role: 'MANAGER' },
      });

      return toChannel(
        await tx.channel.findUniqueOrThrow({
          where: { id: channelId },
          include: include(scope),
        })
      );
    });
  }
}
