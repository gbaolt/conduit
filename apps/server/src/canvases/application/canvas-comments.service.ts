import { parseMentions } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { CanvasCommentsRepository } from '@/canvases/domain/canvas-comments.repository';
import { canvasError } from '@/canvases/domain/canvas-errors';

import { CanvasesService, type CanvasViewerScope } from './canvases.service';

/** Inline comment threads. Anyone who can view a canvas reads them; whoever may comment writes them. */
@Injectable()
export class CanvasCommentsService {
  constructor(
    @Inject(CanvasesService) private readonly canvases: CanvasesService,
    @Inject(CanvasCommentsRepository)
    private readonly comments: CanvasCommentsRepository
  ) {}

  private newComment(viewer: CanvasViewerScope, body: string) {
    return {
      authorId: viewer.userId,
      body,
      mentionedUserIds: parseMentions(body).userIds,
    };
  }

  private async thread(canvasId: string, threadId: string) {
    const thread = await this.comments.findThread(canvasId, threadId);
    if (!thread) throw canvasError('COMMENT_NOT_FOUND');
    return thread;
  }

  /** The viewer's own live comment on the canvas, or `FORBIDDEN` for someone else's. */
  private async ownComment(
    viewer: CanvasViewerScope,
    canvasId: string,
    commentId: string
  ) {
    const comment = await this.comments.findComment(canvasId, commentId);
    if (!comment) throw canvasError('COMMENT_NOT_FOUND');
    if (comment.author.id !== viewer.userId) throw canvasError('FORBIDDEN');
    return comment;
  }

  async list(viewer: CanvasViewerScope, canvasId: string) {
    await this.canvases.load(viewer, canvasId, 'view');
    return this.comments.list(canvasId);
  }

  async createThread(
    viewer: CanvasViewerScope,
    input: { canvasId: string; quote: string; body: string }
  ) {
    await this.canvases.load(viewer, input.canvasId, 'comment');
    return this.comments.createThread(
      {
        canvasId: input.canvasId,
        organizationId: viewer.organizationId,
        quote: input.quote,
      },
      this.newComment(viewer, input.body)
    );
  }

  async reply(
    viewer: CanvasViewerScope,
    input: { canvasId: string; threadId: string; body: string }
  ) {
    await this.canvases.load(viewer, input.canvasId, 'comment');
    await this.thread(input.canvasId, input.threadId);
    return this.comments.reply(
      input.threadId,
      this.newComment(viewer, input.body)
    );
  }

  async edit(
    viewer: CanvasViewerScope,
    input: { canvasId: string; commentId: string; body: string }
  ) {
    await this.canvases.load(viewer, input.canvasId, 'comment');
    await this.ownComment(viewer, input.canvasId, input.commentId);
    return this.comments.edit(
      input.commentId,
      input.body,
      parseMentions(input.body).userIds
    );
  }

  async delete(
    viewer: CanvasViewerScope,
    input: { canvasId: string; commentId: string }
  ) {
    await this.canvases.load(viewer, input.canvasId, 'comment');
    await this.ownComment(viewer, input.canvasId, input.commentId);
    await this.comments.softDelete(input.commentId);
  }

  async resolve(
    viewer: CanvasViewerScope,
    input: { canvasId: string; threadId: string; resolved: boolean }
  ) {
    await this.canvases.load(viewer, input.canvasId, 'comment');
    await this.thread(input.canvasId, input.threadId);
    return this.comments.setResolved(
      input.threadId,
      input.resolved ? viewer.userId : null
    );
  }
}
