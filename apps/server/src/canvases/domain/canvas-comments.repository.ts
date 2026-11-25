import type { CanvasComment, CanvasCommentThread } from '@conduit/contract';

/** A live comment with the thread it belongs to, for checking who may change it. */
export type StoredCanvasComment = CanvasComment & { canvasId: string };

export type NewCanvasComment = {
  authorId: string;
  body: string;
  mentionedUserIds: string[];
};

/** Comment threads on canvases. Callers check access first. Deleted comments are never returned. */
export abstract class CanvasCommentsRepository {
  /** The canvas's threads that still have a comment, oldest first, each with its comments oldest first. */
  abstract list(canvasId: string): Promise<CanvasCommentThread[]>;

  /** The thread, when it is on this canvas and still has a comment. */
  abstract findThread(
    canvasId: string,
    threadId: string
  ): Promise<CanvasCommentThread | null>;

  /** The comment, when it is on this canvas and not deleted. */
  abstract findComment(
    canvasId: string,
    commentId: string
  ): Promise<StoredCanvasComment | null>;

  /** Starts a thread with its first comment, in one transaction. */
  abstract createThread(
    thread: { canvasId: string; organizationId: string; quote: string },
    comment: NewCanvasComment
  ): Promise<CanvasCommentThread>;

  abstract reply(
    threadId: string,
    comment: NewCanvasComment
  ): Promise<CanvasComment>;

  abstract edit(
    commentId: string,
    body: string,
    mentionedUserIds: string[]
  ): Promise<CanvasComment>;

  abstract softDelete(commentId: string): Promise<void>;

  /** Resolves the thread as `resolvedById`, or reopens it when null. */
  abstract setResolved(
    threadId: string,
    resolvedById: string | null
  ): Promise<CanvasCommentThread>;
}
