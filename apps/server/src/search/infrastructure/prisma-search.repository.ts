import type { ListedFile, MessageHit } from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  SearchRepository,
  SearchScope,
} from '@/search/domain/search.repository';

const person = { select: { id: true, name: true, image: true } } as const;
const room = { select: { id: true, name: true, kind: true } } as const;

const toRoom = (row: { id: string; name: string; kind: 'CHANNEL' | 'DM' }) => ({
  id: row.id,
  // A DM stores its key in `name`, and shows no name.
  name: row.kind === 'DM' ? '' : row.name,
  kind: row.kind === 'DM' ? ('dm' as const) : ('channel' as const),
});

const createdIn = (scope: SearchScope) =>
  scope.from || scope.until
    ? {
        createdAt: {
          ...(scope.from && { gte: scope.from }),
          ...(scope.until && { lt: scope.until }),
        },
      }
    : {};

function messageWhere(scope: SearchScope): Prisma.MessageWhereInput {
  return {
    roomId: { in: scope.roomIds },
    room: { organizationId: scope.organizationId },
    deletedAt: null,
    ...(scope.authorIds.length > 0 && { authorId: { in: scope.authorIds } }),
    ...(scope.hasFile && { NOT: { files: { equals: [] } } }),
    ...createdIn(scope),
  };
}

function fileWhere(scope: SearchScope): Prisma.FileWhereInput {
  return {
    organizationId: scope.organizationId,
    roomId: { in: scope.roomIds },
    status: 'READY',
    deletedAt: null,
    message: { deletedAt: null },
    ...(scope.authorIds.length > 0 && {
      uploaderId: { in: scope.authorIds },
    }),
    ...createdIn(scope),
  };
}

const messageInclude = { room, author: person } as const;
const fileInclude = {
  room,
  uploader: person,
  message: { select: { id: true, parentId: true } },
} as const;

type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;
type FileRow = Prisma.FileGetPayload<{ include: typeof fileInclude }>;

const toMessage = (row: MessageRow): MessageHit => ({
  id: row.id,
  parentId: row.parentId,
  body: row.body,
  room: toRoom(row.room),
  author: row.author,
  createdAt: row.createdAt,
});

const toFile = (row: FileRow): ListedFile[] =>
  row.message
    ? [
        {
          id: row.id,
          name: row.name,
          contentType: row.contentType,
          size: row.size,
          width: row.width,
          height: row.height,
          messageId: row.message.id,
          parentId: row.message.parentId,
          room: toRoom(row.room),
          uploader: row.uploader,
          createdAt: row.createdAt,
        },
      ]
    : [];

/** Rows back in the order the index ranked them. */
function inOrder<T extends { id: string }>(ids: string[], rows: T[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

@Injectable()
export class PrismaSearchRepository implements SearchRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async channelIdsNamed(organizationId: string, names: string[]) {
    const rows = await this.db.room.findMany({
      where: {
        organizationId,
        kind: 'CHANNEL',
        OR: names.map((name) => ({
          name: { equals: name, mode: 'insensitive' as const },
        })),
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async userIdsNamed(organizationId: string, names: string[]) {
    const rows = await this.db.member.findMany({
      where: {
        organizationId,
        user: {
          OR: names.flatMap((name) => [
            { name: { equals: name, mode: 'insensitive' as const } },
            { name: { startsWith: `${name} `, mode: 'insensitive' as const } },
            { email: { startsWith: `${name}@`, mode: 'insensitive' as const } },
          ]),
        },
      },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  async dmIdsWith(organizationId: string, viewerId: string, userIds: string[]) {
    const rows = await this.db.room.findMany({
      where: {
        organizationId,
        kind: 'DM',
        members: { some: { userId: viewerId } },
      },
      select: { id: true, members: { select: { userId: true } } },
    });
    return rows
      .filter((row) => {
        const others = row.members
          .map((member) => member.userId)
          .filter((id) => id !== viewerId);
        return others.length === 0
          ? userIds.includes(viewerId)
          : others.length === 1 && userIds.includes(others[0]!);
      })
      .map((row) => row.id);
  }

  async messages(scope: SearchScope, ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.db.message.findMany({
      where: { id: { in: ids }, ...messageWhere(scope) },
      include: messageInclude,
    });
    return inOrder(ids, rows.map(toMessage));
  }

  async files(scope: SearchScope, ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.db.file.findMany({
      where: { id: { in: ids }, ...fileWhere(scope) },
      include: fileInclude,
    });
    return inOrder(ids, rows.flatMap(toFile));
  }

  async recentMessages(scope: SearchScope, limit: number) {
    const rows = await this.db.message.findMany({
      where: messageWhere(scope),
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toMessage);
  }

  async recentFiles(scope: SearchScope, limit: number) {
    const rows = await this.db.file.findMany({
      where: fileWhere(scope),
      include: fileInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.flatMap(toFile);
  }

  async channels(
    organizationId: string,
    viewerId: string,
    roomIds: string[],
    text: string,
    limit: number
  ) {
    const rows = await this.db.room.findMany({
      where: {
        id: { in: roomIds },
        organizationId,
        kind: 'CHANNEL',
        archivedAt: null,
        name: { contains: text, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        topic: true,
        visibility: true,
        _count: { select: { members: true } },
        members: { where: { userId: viewerId }, select: { userId: true } },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      topic: row.topic,
      visibility:
        row.visibility === 'PRIVATE'
          ? ('private' as const)
          : ('public' as const),
      memberCount: row._count.members,
      joined: row.members.length > 0,
    }));
  }

  async people(organizationId: string, text: string, limit: number) {
    const rows = await this.db.member.findMany({
      where: {
        organizationId,
        deactivation: null,
        user: {
          OR: [
            { name: { contains: text, mode: 'insensitive' } },
            { email: { contains: text, mode: 'insensitive' } },
          ],
        },
      },
      select: {
        user: { select: { id: true, name: true, image: true, email: true } },
      },
      orderBy: { user: { name: 'asc' } },
      take: limit,
    });
    return rows.map((row) => row.user);
  }
}
