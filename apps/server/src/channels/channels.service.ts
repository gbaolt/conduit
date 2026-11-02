import {
  type Channel,
  type ChannelAction,
  channelErrors,
  type ChannelMember,
  channelSectionErrors,
  checkChannel,
  type WorkspaceRole,
} from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { ORPCError } from '@orpc/server';

import { prisma } from '@/database/prisma.service';
import { findWorkspaceRole } from '@/orpc/workspace.middleware';

export type ChannelViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

function channelError(code: keyof typeof channelErrors, message?: string) {
  return new ORPCError(code, {
    ...channelErrors[code],
    message: message ?? channelErrors[code].message,
  });
}

function include(viewer: ChannelViewer) {
  return {
    // Count only current workspace members: leaving a workspace fires no hook, so stale rows can remain.
    _count: {
      select: {
        members: {
          where: {
            user: {
              members: { some: { organizationId: viewer.organizationId } },
            },
          },
        },
      },
    },
    members: {
      where: { userId: viewer.userId },
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

function stillInWorkspace(viewer: ChannelViewer) {
  return {
    user: { members: { some: { organizationId: viewer.organizationId } } },
  } satisfies Prisma.ChannelMemberWhereInput;
}

@Injectable()
export class ChannelsService {
  /** Active channels, or only the archived ones when asked. */
  async list(viewer: ChannelViewer, archived = false) {
    const rows = await prisma.channel.findMany({
      where: {
        organizationId: viewer.organizationId,
        archivedAt: archived ? { not: null } : null,
        OR: [
          { visibility: 'PUBLIC' },
          { members: { some: { userId: viewer.userId } } },
        ],
      },
      include: include(viewer),
      orderBy: { name: 'asc' },
    });
    return rows.map(toChannel);
  }

  /** Resolves a channel in any workspace the caller belongs to, so a copied link can switch workspace. */
  async get(userId: string, channelId: string) {
    const row = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { organizationId: true },
    });
    const workspaceRole =
      row && (await findWorkspaceRole(row.organizationId, userId));
    if (!row || !workspaceRole) {
      throw channelError('NOT_FOUND');
    }
    return this.find(
      { userId, organizationId: row.organizationId, workspaceRole },
      channelId
    );
  }

  async create(
    viewer: ChannelViewer,
    input: { name: string; visibility: Channel['visibility'] }
  ) {
    // Prisma runs a nested create in one transaction.
    const row = await prisma.channel
      .create({
        data: {
          organizationId: viewer.organizationId,
          name: input.name,
          visibility: input.visibility === 'private' ? 'PRIVATE' : 'PUBLIC',
          createdById: viewer.userId,
          members: { create: { userId: viewer.userId, role: 'MANAGER' } },
        },
        include: include(viewer),
      })
      .catch(rethrowNameTaken);
    return toChannel(row);
  }

  async rename(viewer: ChannelViewer, channelId: string, name: string) {
    await this.authorize(viewer, channelId, 'rename');
    const row = await prisma.channel
      .update({
        where: { id: channelId },
        data: { name },
        include: include(viewer),
      })
      .catch(rethrowNameTaken);
    return toChannel(row);
  }

  async delete(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'delete');
    await prisma.channel.delete({ where: { id: channelId } });
  }

  async join(viewer: ChannelViewer, channelId: string) {
    const channel = await this.authorize(viewer, channelId, 'join');
    if (channel.membership) {
      return channel;
    }
    await prisma.channelMember.createMany({
      data: { channelId, userId: viewer.userId },
      skipDuplicates: true,
    });
    return this.find(viewer, channelId);
  }

  async leave(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'leave');
    await prisma.channelMember.deleteMany({
      where: { channelId, userId: viewer.userId },
    });
  }

  async archive(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'archive');
    const row = await prisma.channel.update({
      where: { id: channelId },
      data: { archivedAt: new Date(), archivedById: viewer.userId },
      include: include(viewer),
    });
    return toChannel(row);
  }

  async unarchive(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'unarchive');
    const row = await prisma.channel.update({
      where: { id: channelId },
      data: { archivedAt: null, archivedById: null },
      include: include(viewer),
    });
    return toChannel(row);
  }

  async setVisibility(
    viewer: ChannelViewer,
    channelId: string,
    visibility: Channel['visibility']
  ) {
    await this.authorize(
      viewer,
      channelId,
      visibility === 'private' ? 'makePrivate' : 'makePublic'
    );
    const row = await prisma.channel.update({
      where: { id: channelId },
      data: {
        visibility: visibility === 'private' ? 'PRIVATE' : 'PUBLIC',
        // An admin outside the channel would lock themselves out of the channel they just made private.
        members:
          visibility === 'private'
            ? {
                createMany: {
                  data: { userId: viewer.userId },
                  skipDuplicates: true,
                },
              }
            : undefined,
      },
      include: include(viewer),
    });
    return toChannel(row);
  }

  async star(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'star');
    await prisma.channelMember.updateMany({
      where: { channelId, userId: viewer.userId },
      data: { starredAt: new Date() },
    });
  }

  async unstar(viewer: ChannelViewer, channelId: string) {
    await this.authorize(viewer, channelId, 'star');
    await prisma.channelMember.updateMany({
      where: { channelId, userId: viewer.userId },
      data: { starredAt: null },
    });
  }

  async moveToSection(
    viewer: ChannelViewer,
    channelId: string,
    sectionId: string | null
  ) {
    await this.authorize(viewer, channelId, 'moveToSection');
    // Another user's section is as good as missing.
    if (
      sectionId &&
      !(await prisma.channelSection.findFirst({
        where: {
          id: sectionId,
          userId: viewer.userId,
          organizationId: viewer.organizationId,
        },
        select: { id: true },
      }))
    ) {
      throw new ORPCError('NOT_FOUND', channelSectionErrors.NOT_FOUND);
    }
    await prisma.channelMember.updateMany({
      where: { channelId, userId: viewer.userId },
      data: { sectionId },
    });
  }

  /** A channel the viewer cannot see is NOT_FOUND, so private channels do not leak. */
  private async find(viewer: ChannelViewer, channelId: string) {
    const row = await prisma.channel.findFirst({
      where: { id: channelId, organizationId: viewer.organizationId },
      include: include(viewer),
    });
    const channel = row && toChannel(row);
    if (!channel || checkChannel('view', viewer.workspaceRole, channel)) {
      throw channelError('NOT_FOUND');
    }
    return channel;
  }

  private async authorize(
    viewer: ChannelViewer,
    channelId: string,
    action: ChannelAction
  ) {
    const channel = await this.find(viewer, channelId);
    const denial = checkChannel(action, viewer.workspaceRole, channel);
    if (denial) {
      throw channelError(denial);
    }
    return channel;
  }

  async update(
    viewer: ChannelViewer,
    channelId: string,
    input: { topic?: string | null; description?: string | null }
  ) {
    await this.authorize(viewer, channelId, 'editDetails');
    // undefined leaves a column alone; null or empty clears it.
    const text = (value?: string | null) =>
      value === undefined ? undefined : value?.trim() || null;
    const row = await prisma.channel.update({
      where: { id: channelId },
      data: { topic: text(input.topic), description: text(input.description) },
      include: include(viewer),
    });
    return toChannel(row);
  }

  async listMembers(
    viewer: ChannelViewer,
    channelId: string
  ): Promise<ChannelMember[]> {
    await this.find(viewer, channelId);
    const rows = await prisma.channelMember.findMany({
      where: { channelId, ...stillInWorkspace(viewer) },
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

  async addMembers(
    viewer: ChannelViewer,
    channelId: string,
    userIds: string[]
  ) {
    await this.authorize(viewer, channelId, 'addMembers');
    const ids = [...new Set(userIds)];
    const inWorkspace = await prisma.member.count({
      where: { organizationId: viewer.organizationId, userId: { in: ids } },
    });
    if (inWorkspace !== ids.length) {
      throw channelError('NOT_FOUND', 'That person is not in this workspace.');
    }
    await prisma.channelMember.createMany({
      data: ids.map((userId) => ({ channelId, userId })),
      skipDuplicates: true,
    });
  }

  async removeMember(viewer: ChannelViewer, channelId: string, userId: string) {
    await this.authorize(viewer, channelId, 'removeMember');
    if (userId === viewer.userId) {
      throw channelError('FORBIDDEN', 'Use Leave channel to remove yourself.');
    }
    const { count } = await prisma.channelMember.deleteMany({
      where: { channelId, userId },
    });
    if (!count) {
      throw channelError('NOT_FOUND', 'That person is not in this channel.');
    }
  }

  async setMemberRole(
    viewer: ChannelViewer,
    channelId: string,
    userId: string,
    role: ChannelMember['role']
  ) {
    await this.authorize(viewer, channelId, 'setManager');
    const target = await prisma.channelMember.findFirst({
      where: { channelId, userId, ...stillInWorkspace(viewer) },
      select: { role: true },
    });
    if (!target) {
      throw channelError('NOT_FOUND', 'That person is not in this channel.');
    }
    await prisma.$transaction(async (tx) => {
      if (role === 'member' && target.role === 'MANAGER') {
        // Locking the channel row serializes demotions, so two at once cannot both see another manager.
        await tx.$queryRaw`SELECT id FROM "Channel" WHERE id = ${channelId} FOR UPDATE`;
        const managers = await tx.channelMember.count({
          where: { channelId, role: 'MANAGER', ...stillInWorkspace(viewer) },
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
