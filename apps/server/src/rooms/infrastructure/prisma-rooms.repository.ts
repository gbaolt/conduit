import type { NotifyLevel, Room, RoomMember } from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import { roomError } from '@/rooms/domain/room-errors';
import type {
  MembershipPatch,
  RoomScope,
  RoomsRepository,
} from '@/rooms/domain/rooms.repository';

export function include(scope: RoomScope) {
  return {
    // Count only current workspace members: leaving a workspace fires no hook, so stale rows can remain.
    _count: {
      select: {
        members: {
          where: {
            user: {
              members: { some: { organizationId: scope.organizationId } },
            },
          },
        },
      },
    },
    members: {
      where: { userId: scope.userId },
      select: {
        role: true,
        starredAt: true,
        sectionId: true,
        notify: true,
        mutedAt: true,
      },
    },
    archivedBy: { select: { name: true } },
  } satisfies Prisma.RoomInclude;
}

type ChannelRow = Prisma.RoomGetPayload<{
  include: ReturnType<typeof include>;
}>;

export function toChannel(row: ChannelRow): Room {
  const membership = row.members[0];
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: row.kind === 'DM' ? 'dm' : 'channel',
    // A DM stores its key in `name` to keep the column unique, and shows no name.
    name: row.kind === 'DM' ? '' : row.name,
    topic: row.topic,
    description: row.description,
    visibility: row.visibility === 'PRIVATE' ? 'private' : 'public',
    isDefault: row.defaultForOrganizationId !== null,
    archivedAt: row.archivedAt,
    memberCount: row._count.members,
    createdById: row.createdById,
    createdAt: row.createdAt,
    membership: membership
      ? {
          role: membership.role === 'MANAGER' ? 'manager' : 'member',
          starredAt: membership.starredAt,
          sectionId: membership.sectionId,
          notify:
            (membership.notify?.toLowerCase() as NotifyLevel | undefined) ??
            null,
          mutedAt: membership.mutedAt,
        }
      : null,
    archivedByName: row.archivedBy?.name ?? null,
  };
}

// The only unique a create or rename can hit is (organizationId, name).
export function rethrowNameTaken(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw roomError('NAME_TAKEN');
  }
  throw error;
}

function stillInWorkspace(scope: RoomScope) {
  return {
    user: { members: { some: { organizationId: scope.organizationId } } },
  } satisfies Prisma.RoomMemberWhereInput;
}

/** Room and room-member rows. Returns contract types, so no Prisma row leaves this file. */
@Injectable()
export class PrismaRoomsRepository implements RoomsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** Public channels plus the private ones the scope's user belongs to. */
  async list(scope: RoomScope, archived: boolean) {
    const rows = await this.db.room.findMany({
      where: {
        organizationId: scope.organizationId,
        kind: 'CHANNEL',
        archivedAt: archived ? { not: null } : null,
        OR: [
          { visibility: 'PUBLIC' },
          { members: { some: { userId: scope.userId } } },
        ],
      },
      include: include(scope),
      orderBy: { name: 'asc' },
    });
    return rows.map(toChannel);
  }

  /** Any channel in the scope's workspace, private or not. Callers check visibility. */
  async find(scope: RoomScope, roomId: string) {
    const row = await this.db.room.findFirst({
      where: { id: roomId, organizationId: scope.organizationId },
      include: include(scope),
    });
    return row && toChannel(row);
  }

  async findOrganizationId(roomId: string) {
    const row = await this.db.room.findUnique({
      where: { id: roomId },
      select: { organizationId: true },
    });
    return row?.organizationId ?? null;
  }

  /** Creates the channel with its creator as a manager, in one transaction. */
  async create(
    scope: RoomScope,
    input: { name: string; visibility: Room['visibility'] }
  ) {
    const row = await this.db.room
      .create({
        data: {
          organizationId: scope.organizationId,
          name: input.name,
          visibility: input.visibility === 'private' ? 'PRIVATE' : 'PUBLIC',
          createdById: scope.userId,
          members: { create: { userId: scope.userId, role: 'MANAGER' } },
        },
        include: include(scope),
      })
      .catch(rethrowNameTaken);
    return toChannel(row);
  }

  async rename(scope: RoomScope, roomId: string, name: string) {
    const row = await this.db.room
      .update({
        where: { id: roomId },
        data: { name },
        include: include(scope),
      })
      .catch(rethrowNameTaken);
    return toChannel(row);
  }

  /** `undefined` leaves a column alone. */
  async updateDetails(
    scope: RoomScope,
    roomId: string,
    details: { topic?: string | null; description?: string | null }
  ) {
    const row = await this.db.room.update({
      where: { id: roomId },
      data: details,
      include: include(scope),
    });
    return toChannel(row);
  }

  /** Archives as the scope's user, or unarchives. */
  async setArchived(scope: RoomScope, roomId: string, archived: boolean) {
    const row = await this.db.room.update({
      where: { id: roomId },
      data: archived
        ? { archivedAt: new Date(), archivedById: scope.userId }
        : { archivedAt: null, archivedById: null },
      include: include(scope),
    });
    return toChannel(row);
  }

  async setVisibility(
    scope: RoomScope,
    roomId: string,
    visibility: Room['visibility']
  ) {
    const row = await this.db.room.update({
      where: { id: roomId },
      data: {
        visibility: visibility === 'private' ? 'PRIVATE' : 'PUBLIC',
        // An admin outside the channel would lock themselves out of the channel they just made private.
        members:
          visibility === 'private'
            ? {
                createMany: {
                  data: { userId: scope.userId },
                  skipDuplicates: true,
                },
              }
            : undefined,
      },
      include: include(scope),
    });
    return toChannel(row);
  }

  async delete(roomId: string) {
    await this.db.room.delete({ where: { id: roomId } });
  }

  /** Adds each user once. Users already in the channel are skipped. */
  async addMembers(roomId: string, userIds: string[]) {
    await this.db.roomMember.createMany({
      data: userIds.map((userId) => ({ roomId, userId })),
      skipDuplicates: true,
    });
  }

  /** Returns how many rows were removed, 0 or 1. */
  async removeMember(roomId: string, userId: string) {
    const { count } = await this.db.roomMember.deleteMany({
      where: { roomId, userId },
    });
    return count;
  }

  /** The user's own settings on a channel. Does nothing when they are not a member. */
  async updateMembership(
    roomId: string,
    userId: string,
    { notify, ...data }: MembershipPatch
  ) {
    await this.db.roomMember.updateMany({
      where: { roomId, userId },
      data: {
        ...data,
        notify: notify && (notify.toUpperCase() as Uppercase<NotifyLevel>),
      },
    });
  }

  /** Current workspace members of the channel, managers first. */
  async listMembers(scope: RoomScope, roomId: string): Promise<RoomMember[]> {
    const rows = await this.db.roomMember.findMany({
      where: { roomId, ...stillInWorkspace(scope) },
      include: { user: { select: { name: true, email: true, image: true } } },
      // MANAGER is declared first in the enum, so managers sort first.
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map((row) => ({
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image,
      role: row.role === 'MANAGER' ? 'manager' : 'member',
      joinedAt: row.joinedAt,
    }));
  }

  /** The member's channel role, or null when they are not a current workspace member in the channel. */
  async findMemberRole(
    scope: RoomScope,
    roomId: string,
    userId: string
  ): Promise<RoomMember['role'] | null> {
    const row = await this.db.roomMember.findFirst({
      where: { roomId, userId, ...stillInWorkspace(scope) },
      select: { role: true },
    });
    return row && (row.role === 'MANAGER' ? 'manager' : 'member');
  }

  /** Throws `LAST_MANAGER` when `demotingManager` would leave the channel with none. */
  async setMemberRole(
    scope: RoomScope,
    roomId: string,
    userId: string,
    role: RoomMember['role'],
    demotingManager: boolean
  ) {
    await this.db.$transaction(async (tx) => {
      if (demotingManager) {
        // Locking the channel row serializes demotions, so two at once cannot both see another manager.
        await tx.$queryRaw`SELECT id FROM "Channel" WHERE id = ${roomId} FOR UPDATE`;
        const managers = await tx.roomMember.count({
          where: { roomId, role: 'MANAGER', ...stillInWorkspace(scope) },
        });
        if (managers <= 1) {
          throw roomError('LAST_MANAGER');
        }
      }
      await tx.roomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { role: role === 'manager' ? 'MANAGER' : 'MEMBER' },
      });
    });
  }
}
