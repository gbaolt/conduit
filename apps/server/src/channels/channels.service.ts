import {
  type Channel,
  type ChannelAction,
  channelErrors,
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

function channelError(code: keyof typeof channelErrors) {
  return new ORPCError(code, channelErrors[code]);
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

@Injectable()
export class ChannelsService {
  async list(viewer: ChannelViewer) {
    const rows = await prisma.channel.findMany({
      where: {
        organizationId: viewer.organizationId,
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
}
