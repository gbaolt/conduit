import type { MessageHit, WorkspaceRole } from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import type {
  AskContextRepository,
  ChannelFacts,
} from '@/ask/domain/ask-context.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/** How many member names one channel lists, managers first. */
export const ASK_CHANNEL_MEMBERS_MAX = 50;

const person = { select: { id: true, name: true, image: true } } as const;
const messageInclude = {
  room: { select: { id: true, name: true } },
  author: person,
} as const;
type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

// Every room these read is a channel, because `channelIds` returns no DM.
const toMessage = (row: MessageRow): MessageHit => ({
  id: row.id,
  parentId: row.parentId,
  body: row.body,
  room: { id: row.room.id, name: row.room.name, kind: 'channel' },
  author: row.author,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// Better Auth stores multiple roles comma-separated.
function toRole(stored: string): WorkspaceRole {
  const roles = stored.split(',').map((role) => role.trim());
  if (roles.includes('owner')) return 'owner';
  return roles.includes('admin') ? 'admin' : 'member';
}

@Injectable()
export class PrismaAskContextRepository implements AskContextRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async channelIds(organizationId: string, userId: string) {
    const rows = await this.db.room.findMany({
      where: {
        organizationId,
        kind: 'CHANNEL',
        OR: [{ visibility: 'PUBLIC' }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async channels(
    roomIds: string[],
    text: string,
    limit: number
  ): Promise<ChannelFacts[]> {
    const rows = await this.db.room.findMany({
      where: {
        id: { in: roomIds },
        kind: 'CHANNEL',
        name: { contains: text.replace(/^#/, ''), mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        topic: true,
        description: true,
        visibility: true,
        archivedAt: true,
        _count: { select: { members: true } },
        members: {
          select: { role: true, user: { select: { name: true } } },
          orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
          take: ASK_CHANNEL_MEMBERS_MAX,
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      topic: row.topic,
      description: row.description,
      visibility: row.visibility === 'PRIVATE' ? 'private' : 'public',
      archived: row.archivedAt !== null,
      memberCount: row._count.members,
      members: row.members.map((member) => ({
        name: member.user.name,
        manager: member.role === 'MANAGER',
      })),
    }));
  }

  async channelsById(roomIds: string[], ids: string[]) {
    if (ids.length === 0) return [];
    const allowed = new Set(roomIds);
    return this.db.room.findMany({
      where: {
        id: { in: ids.filter((id) => allowed.has(id)) },
        kind: 'CHANNEL',
      },
      select: { id: true, name: true, topic: true },
    });
  }

  async people(organizationId: string, text: string, limit: number) {
    const rows = await this.db.member.findMany({
      where: {
        organizationId,
        deactivation: null,
        user: { name: { contains: text, mode: 'insensitive' } },
      },
      select: { role: true, user: person },
      orderBy: { user: { name: 'asc' } },
      take: limit,
    });
    return rows.map((row) => ({ ...row.user, role: toRole(row.role) }));
  }

  async peopleById(organizationId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.db.member.findMany({
      where: { organizationId, deactivation: null, userId: { in: ids } },
      select: { user: person },
    });
    return rows.map((row) => row.user);
  }

  async thread(roomIds: string[], messageId: string, limit: number) {
    const hit = await this.db.message.findFirst({
      where: { id: messageId, roomId: { in: roomIds }, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!hit) return [];
    const rootId = hit.parentId ?? hit.id;
    const rows = await this.db.message.findMany({
      where: {
        roomId: { in: roomIds },
        deletedAt: null,
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    // The root sorts first, being older than every reply.
    return rows.map(toMessage);
  }

  async saved(userId: string, roomIds: string[], limit: number) {
    const rows = await this.db.savedMessage.findMany({
      where: {
        userId,
        message: { roomId: { in: roomIds }, deletedAt: null },
      },
      include: { message: { include: messageInclude } },
      orderBy: [{ savedAt: 'desc' }, { messageId: 'desc' }],
      take: limit,
    });
    return rows.map((row) => toMessage(row.message));
  }

  async drafts(userId: string, roomIds: string[], limit: number) {
    const rows = await this.db.draft.findMany({
      where: { userId, roomId: { in: roomIds }, NOT: { body: '' } },
      select: {
        parentId: true,
        body: true,
        updatedAt: true,
        room: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      room: row.room,
      parentId: row.parentId || null,
      body: row.body,
      updatedAt: row.updatedAt,
    }));
  }
}
