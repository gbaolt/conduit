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

const toStored = (row: Prisma.AnswerGetPayload<object>): StoredAnswer => ({
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

  async addAnswer(target: AnswerTarget, answer: NewAnswer) {
    if ('newChat' in target) {
      const chat = await this.db.askChat.create({
        data: { ...target.newChat, answers: { create: answer } },
        select: { answers: true },
      });
      return toStored(chat.answers[0]!);
    }
    const [row] = await this.db.$transaction([
      this.db.answer.create({ data: { ...answer, chatId: target.chatId } }),
      this.db.askChat.update({
        where: { id: target.chatId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return toStored(row);
  }

  async findChat(chatId: string) {
    const chat = await this.db.askChat.findUnique({
      where: { id: chatId },
      select: { ...chatFields, answers: { orderBy: { createdAt: 'asc' } } },
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
