import type { Channel, ChannelMember } from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';

import { channelError } from './channel-errors';

/** Whose view of a channel to load: the member counts and the `membership` field depend on it. */
export type ChannelScope = { userId: string; organizationId: string };

function include(scope: ChannelScope) {
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
      select: { role: true, starredAt: true, sectionId: true },
    },
    archivedBy: { select: { name: true } },
  } satisfies Prisma.ChannelInclude;
}

type ChannelRow = Prisma.ChannelGetPayload<{
  include: ReturnType<typeof include>;
}>;

function toChannel(row: ChannelRow): Channel {
  const membership = row.members[0];
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
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
        }
      : null,
    archivedByName: row.archivedBy?.name ?? null,
  };
}

// The only unique a create or rename can hit is (organizationId, name).
function rethrowNameTaken(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw channelError('NAME_TAKEN');
  }
  throw error;
}

function stillInWorkspace(scope: ChannelScope) {
  return {
    user: { members: { some: { organizationId: scope.organizationId } } },
  } satisfies Prisma.ChannelMemberWhereInput;
}

/** Channel and channel-member rows. Returns contract types, so no Prisma row leaves this file. */
@Injectable()
export class ChannelsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** Public channels plus the private ones the scope's user belongs to. */
  async list(scope: ChannelScope, archived: boolean) {
    const rows = await this.db.channel.findMany({
      where: {
        organizationId: scope.organizationId,
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
  async find(scope: ChannelScope, channelId: string) {
    const row = await this.db.channel.findFirst({
      where: { id: channelId, organizationId: scope.organizationId },
      include: include(scope),
    });
    return row && toChannel(row);
  }

  async findOrganizationId(channelId: string) {
    const row = await this.db.channel.findUnique({
      where: { id: channelId },
      select: { organizationId: true },
    });
    return row?.organizationId ?? null;
  }

  /** Creates the channel with its creator as a manager, in one transaction. */
  async create(
    scope: ChannelScope,
    input: { name: string; visibility: Channel['visibility'] }
  ) {
    const row = await this.db.channel
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

  async rename(scope: ChannelScope, channelId: string, name: string) {
    const row = await this.db.channel
      .update({
        where: { id: channelId },
        data: { name },
        include: include(scope),
      })
      .catch(rethrowNameTaken);
    return toChannel(row);
  }

  /** `undefined` leaves a column alone. */
  async updateDetails(
    scope: ChannelScope,
    channelId: string,
    details: { topic?: string | null; description?: string | null }
  ) {
    const row = await this.db.channel.update({
      where: { id: channelId },
      data: details,
      include: include(scope),
    });
    return toChannel(row);
  }

  /** Archives as the scope's user, or unarchives. */
  async setArchived(scope: ChannelScope, channelId: string, archived: boolean) {
    const row = await this.db.channel.update({
      where: { id: channelId },
      data: archived
        ? { archivedAt: new Date(), archivedById: scope.userId }
        : { archivedAt: null, archivedById: null },
      include: include(scope),
    });
    return toChannel(row);
  }

  async setVisibility(
    scope: ChannelScope,
    channelId: string,
    visibility: Channel['visibility']
  ) {
    const row = await this.db.channel.update({
      where: { id: channelId },
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

  async delete(channelId: string) {
    await this.db.channel.delete({ where: { id: channelId } });
  }

  /** Adds each user once. Users already in the channel are skipped. */
  async addMembers(channelId: string, userIds: string[]) {
    await this.db.channelMember.createMany({
      data: userIds.map((userId) => ({ channelId, userId })),
      skipDuplicates: true,
    });
  }

  /** Returns how many rows were removed, 0 or 1. */
  async removeMember(channelId: string, userId: string) {
    const { count } = await this.db.channelMember.deleteMany({
      where: { channelId, userId },
    });
    return count;
  }

  /** The user's own settings on a channel. Does nothing when they are not a member. */
  async updateMembership(
    channelId: string,
    userId: string,
    data: { starredAt?: Date | null; sectionId?: string | null }
  ) {
    await this.db.channelMember.updateMany({
      where: { channelId, userId },
      data,
    });
  }

  /** Current workspace members of the channel, managers first. */
  async listMembers(
    scope: ChannelScope,
    channelId: string
  ): Promise<ChannelMember[]> {
    const rows = await this.db.channelMember.findMany({
      where: { channelId, ...stillInWorkspace(scope) },
      include: { user: { select: { name: true, image: true } } },
      // MANAGER is declared first in the enum, so managers sort first.
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map((row) => ({
      userId: row.userId,
      name: row.user.name,
      image: row.user.image,
      role: row.role === 'MANAGER' ? 'manager' : 'member',
      joinedAt: row.joinedAt,
    }));
  }

  /** The member's channel role, or null when they are not a current workspace member in the channel. */
  async findMemberRole(
    scope: ChannelScope,
    channelId: string,
    userId: string
  ): Promise<ChannelMember['role'] | null> {
    const row = await this.db.channelMember.findFirst({
      where: { channelId, userId, ...stillInWorkspace(scope) },
      select: { role: true },
    });
    return row && (row.role === 'MANAGER' ? 'manager' : 'member');
  }

  /** Throws `LAST_MANAGER` when `demotingManager` would leave the channel with none. */
  async setMemberRole(
    scope: ChannelScope,
    channelId: string,
    userId: string,
    role: ChannelMember['role'],
    demotingManager: boolean
  ) {
    await this.db.$transaction(async (tx) => {
      if (demotingManager) {
        // Locking the channel row serializes demotions, so two at once cannot both see another manager.
        await tx.$queryRaw`SELECT id FROM "Channel" WHERE id = ${channelId} FOR UPDATE`;
        const managers = await tx.channelMember.count({
          where: { channelId, role: 'MANAGER', ...stillInWorkspace(scope) },
        });
        if (managers <= 1) {
          throw channelError('LAST_MANAGER');
        }
      }
      await tx.channelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { role: role === 'manager' ? 'MANAGER' : 'MEMBER' },
      });
    });
  }
}
