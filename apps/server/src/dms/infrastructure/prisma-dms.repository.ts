import type { Dm } from '@conduit/contract';
import { DM_MEMBERS_MAX } from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { dmError } from '@/dms/domain/dm-errors';
import { dmKey } from '@/dms/domain/dm-key';
import type { DmsRepository } from '@/dms/domain/dms.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { roomError } from '@/rooms/domain/room-errors';
import type { RoomScope } from '@/rooms/domain/rooms.repository';

import {
  include,
  rethrowNameTaken,
  toChannel,
} from '../../rooms/infrastructure/prisma-rooms.repository';

const dmInclude = {
  members: {
    select: {
      userId: true,
      user: { select: { name: true, image: true } },
    },
    orderBy: { joinedAt: 'asc' },
  },
} satisfies Prisma.RoomInclude;

type DmRow = Prisma.RoomGetPayload<{ include: typeof dmInclude }>;

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

  async list(scope: RoomScope) {
    const rows = await this.db.room.findMany({
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

  async open(scope: RoomScope, userIds: string[]) {
    const key = dmKey(scope.organizationId, userIds);

    // Both writes skip rows that exist, so two opens at once, or a retry, converge on one DM.
    await this.db.room.createMany({
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
    const { id } = await this.db.room.findUniqueOrThrow({
      where: { dmKey: key },
      select: { id: true },
    });
    // Also restores someone whose memberships a workspace removal deleted.
    await this.db.roomMember.createMany({
      data: userIds.map((userId) => ({ roomId: id, userId })),
      skipDuplicates: true,
    });

    return toDm(
      await this.db.room.findUniqueOrThrow({
        where: { id },
        include: dmInclude,
      })
    );
  }

  async addPeople(scope: RoomScope, roomId: string, userIds: string[]) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Channel" WHERE id = ${roomId} FOR UPDATE`;
      const current = await tx.roomMember.findMany({
        where: { roomId },
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
        await tx.room
          .update({ where: { id: roomId }, data: { dmKey: key, name: key } })
          .catch((error: unknown) => {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              throw dmError('DM_EXISTS');
            }
            throw error;
          });
        await tx.roomMember.createMany({
          data: everyone.map((userId) => ({ roomId, userId })),
          skipDuplicates: true,
        });
      }

      return toDm(
        await tx.room.findUniqueOrThrow({
          where: { id: roomId },
          include: dmInclude,
        })
      );
    });
  }

  async convertToChannel(scope: RoomScope, roomId: string, name: string) {
    return this.db.$transaction(async (tx) => {
      // Matching on `kind` makes a second conversion at once find nothing.
      const { count } = await tx.room
        .updateMany({
          where: { id: roomId, kind: 'DM' },
          data: { kind: 'CHANNEL', visibility: 'PRIVATE', name, dmKey: null },
        })
        .catch(rethrowNameTaken);
      if (count === 0) {
        throw roomError('NOT_FOUND');
      }
      // A private channel needs a manager, and a DM has none.
      await tx.roomMember.updateMany({
        where: { roomId, userId: scope.userId },
        data: { role: 'MANAGER' },
      });

      return toChannel(
        await tx.room.findUniqueOrThrow({
          where: { id: roomId },
          include: include(scope),
        })
      );
    });
  }
}
