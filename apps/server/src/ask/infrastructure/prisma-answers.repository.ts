import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import type {
  AnswerRef,
  AnswersRepository,
  AnswerTarget,
  NewAnswer,
  StoredAnswer,
} from '@/ask/domain/answers.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const withAttachments = {
  attachments: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.AnswerInclude;

const toStored = (
  row: Prisma.AnswerGetPayload<{ include: typeof withAttachments }>
): StoredAnswer => ({
  ...row,
  sources: row.sources as AnswerRef[],
});

const chatFields = {
  id: true,
  organizationId: true,
  ownerId: true,
  title: true,
  updatedAt: true,
} as const;

@Injectable()
export class PrismaAnswersRepository implements AnswersRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async addAnswer(
    target: AnswerTarget,
    { attachmentIds, ...answer }: NewAnswer
  ) {
    return this.db.$transaction(async (tx) => {
      const chatId =
        'newChat' in target
          ? (await tx.askChat.create({ data: target.newChat })).id
          : (
              await tx.askChat.update({
                where: { id: target.chatId },
                data: { updatedAt: new Date() },
              })
            ).id;
      const { id } = await tx.answer.create({ data: { ...answer, chatId } });
      if (attachmentIds.length > 0) {
        await tx.askAttachment.updateMany({
          where: { id: { in: attachmentIds }, answerId: null },
          data: { answerId: id },
        });
      }
      return toStored(
        await tx.answer.findUniqueOrThrow({
          where: { id },
          include: withAttachments,
        })
      );
    });
  }

  async findChat(chatId: string) {
    const chat = await this.db.askChat.findUnique({
      where: { id: chatId },
      select: {
        ...chatFields,
        answers: { orderBy: { createdAt: 'asc' }, include: withAttachments },
      },
    });
    return chat && { ...chat, answers: chat.answers.map(toStored) };
  }

  listChats(organizationId: string, ownerId: string, limit: number) {
    return this.db.askChat.findMany({
      where: { organizationId, ownerId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: chatFields,
    });
  }

  async deleteChat(chatId: string) {
    await this.db.askChat.deleteMany({ where: { id: chatId } });
  }

  async userNames(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, string>();
    const users = await this.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }
}
