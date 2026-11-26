import type { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import type {
  CanvasCommentsRepository,
  NewCanvasComment,
} from '@/canvases/domain/canvas-comments.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const commentSelect = {
  id: true,
  threadId: true,
  body: true,
  editedAt: true,
  createdAt: true,
  author: { select: { id: true, name: true, image: true } },
} satisfies Prisma.CanvasCommentSelect;

const live = { deletedAt: null } satisfies Prisma.CanvasCommentWhereInput;

const threadSelect = {
  id: true,
  canvasId: true,
  quote: true,
  resolvedAt: true,
  createdAt: true,
  comments: {
    where: live,
    select: commentSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.CanvasCommentThreadSelect;

const hasComments = {
  comments: { some: live },
} satisfies Prisma.CanvasCommentThreadWhereInput;

@Injectable()
export class PrismaCanvasCommentsRepository implements CanvasCommentsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  list(canvasId: string) {
    return this.db.canvasCommentThread.findMany({
      where: { canvasId, ...hasComments },
      select: threadSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findThread(canvasId: string, threadId: string) {
    return this.db.canvasCommentThread.findFirst({
      where: { id: threadId, canvasId, ...hasComments },
      select: threadSelect,
    });
  }

  async findComment(canvasId: string, commentId: string) {
    const row = await this.db.canvasComment.findFirst({
      where: { id: commentId, ...live, thread: { canvasId } },
      select: { ...commentSelect, thread: { select: { canvasId: true } } },
    });
    if (!row) return null;
    const { thread, ...comment } = row;
    return { ...comment, canvasId: thread.canvasId };
  }

  createThread(
    thread: { canvasId: string; organizationId: string; quote: string },
    comment: NewCanvasComment
  ) {
    return this.db.canvasCommentThread.create({
      data: {
        ...thread,
        createdById: comment.authorId,
        comments: { create: comment },
      },
      select: threadSelect,
    });
  }

  reply(threadId: string, comment: NewCanvasComment) {
    return this.db.canvasComment.create({
      data: { threadId, ...comment },
      select: commentSelect,
    });
  }

  edit(commentId: string, body: string, mentionedUserIds: string[]) {
    return this.db.canvasComment.update({
      where: { id: commentId },
      data: { body, mentionedUserIds, editedAt: new Date() },
      select: commentSelect,
    });
  }

  async softDelete(commentId: string) {
    await this.db.canvasComment.update({
      where: { id: commentId },
      data: { body: '', mentionedUserIds: [], deletedAt: new Date() },
    });
  }

  setResolved(threadId: string, resolvedById: string | null) {
    return this.db.canvasCommentThread.update({
      where: { id: threadId },
      data: { resolvedById, resolvedAt: resolvedById ? new Date() : null },
      select: threadSelect,
    });
  }
}
