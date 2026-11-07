import type { Message, ReactionSummary } from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  MessageMentions,
  MessagesRepository,
} from '@/messages/domain/messages.repository';

type MessageRow = Prisma.MessageGetPayload<object>;

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    clientId: row.clientId,
    parentId: row.parentId,
    alsoSentToChannel: row.alsoSentToChannel,
    body: row.body,
    mentionedUserIds: row.mentionedUserIds,
    mentionsChannel: row.mentionsChannel,
    mentionsHere: row.mentionsHere,
    reactions: row.reactions as ReactionSummary,
    replyCount: row.replyCount,
    lastReplyAt: row.lastReplyAt,
    linkPreview: row.linkPreview,
    pinnedAt: row.pinnedAt,
    pinnedById: row.pinnedById,
    editedAt: row.editedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mentionColumns(mentions: MessageMentions) {
  return {
    mentionedUserIds: mentions.userIds,
    mentionsChannel: mentions.channel,
    mentionsHere: mentions.here,
  };
}

/** Message rows. Returns contract types, so no Prisma row leaves this file. */
@Injectable()
export class PrismaMessagesRepository implements MessagesRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(channelId: string, page: { before?: string; limit: number }) {
    const cursor = page.before
      ? await this.db.message.findUnique({
          where: { id: page.before },
          select: { id: true, channelId: true, createdAt: true },
        })
      : null;
    if (page.before && cursor?.channelId !== channelId) {
      return null;
    }

    const rows = await this.db.message.findMany({
      where: {
        channelId,
        AND: [
          { OR: [{ parentId: null }, { alsoSentToChannel: true }] },
          { OR: [{ deletedAt: null }, { replyCount: { gt: 0 } }] },
          cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
    });

    return {
      messages: rows.slice(0, page.limit).map(toMessage),
      hasMore: rows.length > page.limit,
    };
  }

  async find(messageId: string) {
    const row = await this.db.message.findUnique({ where: { id: messageId } });
    return row && toMessage(row);
  }

  async send(input: {
    channelId: string;
    authorId: string;
    clientId: string;
    body: string;
    mentions: MessageMentions;
  }) {
    const key = {
      authorId_clientId: {
        authorId: input.authorId,
        clientId: input.clientId,
      },
    };

    return this.db.$transaction(async (tx) => {
      // skipDuplicates keeps a retried send from aborting the transaction on the unique key.
      const { count } = await tx.message.createMany({
        data: {
          channelId: input.channelId,
          authorId: input.authorId,
          clientId: input.clientId,
          body: input.body,
          ...mentionColumns(input.mentions),
        },
        skipDuplicates: true,
      });
      const row = await tx.message.findUniqueOrThrow({ where: key });
      if (count === 0) {
        return { message: toMessage(row), txid: null };
      }

      await tx.channel.update({
        where: { id: input.channelId },
        data: { lastMessageAt: row.createdAt },
      });
      const [{ txid }] = await tx.$queryRaw<
        [{ txid: string }]
      >`SELECT pg_current_xact_id()::text AS txid`;
      return { message: toMessage(row), txid };
    });
  }

  async edit(messageId: string, body: string, mentions: MessageMentions) {
    const row = await this.db.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date(), ...mentionColumns(mentions) },
    });
    return toMessage(row);
  }

  async markDeleted(messageId: string) {
    await this.db.message.update({
      where: { id: messageId },
      data: {
        body: '',
        deletedAt: new Date(),
        mentionedUserIds: [],
        mentionsChannel: false,
        mentionsHere: false,
        linkPreview: Prisma.DbNull,
      },
    });
  }

  async updateReactions(
    messageId: string,
    update: (current: ReactionSummary) => ReactionSummary | null
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Message" WHERE "id" = ${messageId} FOR UPDATE`;
      const row = await tx.message.findUniqueOrThrow({
        where: { id: messageId },
      });

      const current = row.reactions as ReactionSummary;
      const next = update(current);
      if (!next) return null;
      if (next === current) return toMessage(row);

      return toMessage(
        await tx.message.update({
          where: { id: messageId },
          data: { reactions: next },
        })
      );
    });
  }

  async setPinned(messageId: string, pinnedById: string | null) {
    const row = await this.db.message.update({
      where: { id: messageId },
      data: pinnedById
        ? { pinnedAt: new Date(), pinnedById }
        : { pinnedAt: null, pinnedById: null },
    });
    return toMessage(row);
  }

  async listPinned(channelId: string) {
    const rows = await this.db.message.findMany({
      where: { channelId, pinnedAt: { not: null }, deletedAt: null },
      orderBy: [{ pinnedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toMessage);
  }
}
