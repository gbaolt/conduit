import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  CanvasBootstrapSchema,
  CanvasCommentInputSchema,
  CanvasCommentSchema,
  CanvasCommentThreadSchema,
  CanvasDocumentSchema,
  CanvasIdInputSchema,
  CanvasLiveblocksAuthSchema,
  CanvasMemberInputSchema,
  CanvasMemberSchema,
  CanvasSchema,
  CanvasSnapshotSavedSchema,
  CanvasVersionInputSchema,
  CanvasVersionPageSchema,
  CanvasVersionRestoredSchema,
  CanvasVersionSchema,
  CanvasVersionSummarySchema,
  CreateCanvasCommentThreadInputSchema,
  CreateCanvasInputSchema,
  CreateCanvasVersionInputSchema,
  EditCanvasCommentInputSchema,
  EmbeddedMessageSchema,
  EmbeddedMessagesInputSchema,
  ListCanvasesInputSchema,
  ListCanvasVersionsInputSchema,
  ReplyCanvasCommentInputSchema,
  ResolveCanvasCommentThreadInputSchema,
  RestoreCanvasVersionInputSchema,
  SaveCanvasSnapshotInputSchema,
  ShareCanvasInputSchema,
  UpdateCanvasInputSchema,
  UpdateCanvasMemberRoleInputSchema,
} from '@/schemas/canvases';
import { RoomIdInputSchema } from '@/schemas/rooms';

export const canvasErrors = {
  NOT_FOUND: { status: 404, message: 'Canvas not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that on this canvas.',
  },
  CHANNEL_ARCHIVED: {
    status: 409,
    message: 'This channel is archived, so its canvas is read-only.',
  },
  LAST_EDITOR: {
    status: 409,
    message: 'A canvas needs at least one person who can edit it.',
  },
  NOT_A_MEMBER: {
    status: 400,
    message: 'Share only with people in this workspace.',
  },
  COMMENT_NOT_FOUND: { status: 404, message: 'Comment not found.' },
  VERSION_NOT_FOUND: { status: 404, message: 'Version not found.' },
} as const;

const {
  NOT_FOUND,
  FORBIDDEN,
  CHANNEL_ARCHIVED,
  LAST_EDITOR,
  NOT_A_MEMBER,
  COMMENT_NOT_FOUND,
  VERSION_NOT_FOUND,
} = canvasErrors;

/** The channel's canvas, or null before anyone creates it. */
export const getChannelCanvasContract = oc
  .meta(openapi({ method: 'GET', path: '/rooms/{roomId}/canvas' }))
  .errors({ NOT_FOUND })
  .input(RoomIdInputSchema)
  .output(CanvasDocumentSchema.nullable());

/** Every canvas the viewer can read, recently updated first. */
export const listCanvasesContract = oc
  .meta(openapi({ method: 'GET', path: '/canvases' }))
  .input(ListCanvasesInputSchema)
  .output(z.array(CanvasSchema));

export const getCanvasContract = oc
  .meta(openapi({ method: 'GET', path: '/canvases/{canvasId}' }))
  .errors({ NOT_FOUND })
  .input(CanvasIdInputSchema)
  .output(CanvasDocumentSchema);

export const createCanvasContract = oc
  .meta(openapi({ method: 'POST', path: '/canvases' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(CreateCanvasInputSchema)
  .output(CanvasDocumentSchema);

export const updateCanvasContract = oc
  .meta(openapi({ method: 'PATCH', path: '/canvases/{canvasId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(UpdateCanvasInputSchema)
  .output(CanvasSchema);

export const deleteCanvasContract = oc
  .meta(openapi({ method: 'DELETE', path: '/canvases/{canvasId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(CanvasIdInputSchema)
  .output(z.void());

/** The people a standalone canvas is shared with. Empty for a channel canvas, which its channel's people read. */
export const listCanvasMembersContract = oc
  .meta(openapi({ method: 'GET', path: '/canvases/{canvasId}/members' }))
  .errors({ NOT_FOUND })
  .input(CanvasIdInputSchema)
  .output(z.array(CanvasMemberSchema));

export const shareCanvasContract = oc
  .meta(openapi({ method: 'POST', path: '/canvases/{canvasId}/members' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, LAST_EDITOR, NOT_A_MEMBER })
  .input(ShareCanvasInputSchema)
  .output(z.void());

export const updateCanvasMemberRoleContract = oc
  .meta(
    openapi({ method: 'PATCH', path: '/canvases/{canvasId}/members/{userId}' })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, LAST_EDITOR })
  .input(UpdateCanvasMemberRoleInputSchema)
  .output(z.void());

/** Anyone may remove themselves. Removing someone else takes `manageSharing`. */
export const removeCanvasMemberContract = oc
  .meta(
    openapi({ method: 'DELETE', path: '/canvases/{canvasId}/members/{userId}' })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, LAST_EDITOR })
  .input(CanvasMemberInputSchema)
  .output(z.void());

/** Read access to the canvas's live room for anyone who can view it, and write access for editors. */
export const canvasLiveblocksAuthContract = oc
  .meta(
    openapi({ method: 'POST', path: '/canvases/{canvasId}/liveblocks-auth' })
  )
  .errors({ NOT_FOUND })
  .input(CanvasIdInputSchema)
  .output(CanvasLiveblocksAuthSchema);

/** Claims the one-time seeding of the canvas's empty live document. Viewers never claim it. */
export const claimCanvasBootstrapContract = oc
  .meta(openapi({ method: 'POST', path: '/canvases/{canvasId}/bootstrap' }))
  .errors({ NOT_FOUND })
  .input(CanvasIdInputSchema)
  .output(CanvasBootstrapSchema);

/** Mirrors the live document into Postgres. */
export const saveCanvasSnapshotContract = oc
  .meta(openapi({ method: 'PUT', path: '/canvases/{canvasId}/snapshot' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(SaveCanvasSnapshotInputSchema)
  .output(CanvasSnapshotSavedSchema);

/** Every thread with at least one comment, oldest first. Anyone who can view the canvas reads them. */
export const listCanvasCommentsContract = oc
  .meta(openapi({ method: 'GET', path: '/canvases/{canvasId}/threads' }))
  .errors({ NOT_FOUND })
  .input(CanvasIdInputSchema)
  .output(z.array(CanvasCommentThreadSchema));

export const createCanvasCommentThreadContract = oc
  .meta(openapi({ method: 'POST', path: '/canvases/{canvasId}/threads' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(CreateCanvasCommentThreadInputSchema)
  .output(CanvasCommentThreadSchema);

export const replyCanvasCommentContract = oc
  .meta(
    openapi({
      method: 'POST',
      path: '/canvases/{canvasId}/threads/{threadId}/comments',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, COMMENT_NOT_FOUND })
  .input(ReplyCanvasCommentInputSchema)
  .output(CanvasCommentSchema);

/** Only a comment's author may edit it. */
export const editCanvasCommentContract = oc
  .meta(
    openapi({
      method: 'PATCH',
      path: '/canvases/{canvasId}/comments/{commentId}',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, COMMENT_NOT_FOUND })
  .input(EditCanvasCommentInputSchema)
  .output(CanvasCommentSchema);

/** Only a comment's author may delete it. A thread left with no comments leaves the list. */
export const deleteCanvasCommentContract = oc
  .meta(
    openapi({
      method: 'DELETE',
      path: '/canvases/{canvasId}/comments/{commentId}',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, COMMENT_NOT_FOUND })
  .input(CanvasCommentInputSchema)
  .output(z.void());

export const resolveCanvasCommentThreadContract = oc
  .meta(
    openapi({
      method: 'PATCH',
      path: '/canvases/{canvasId}/threads/{threadId}',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, COMMENT_NOT_FOUND })
  .input(ResolveCanvasCommentThreadInputSchema)
  .output(CanvasCommentThreadSchema);

/** The messages a canvas embeds, in the order asked, each checked against the rooms the viewer can read. */
export const canvasEmbeddedMessagesContract = oc
  .meta(
    openapi({ method: 'POST', path: '/canvases/{canvasId}/embedded-messages' })
  )
  .errors({ NOT_FOUND })
  .input(EmbeddedMessagesInputSchema)
  .output(z.array(EmbeddedMessageSchema));

/** The canvas's versions, newest first. Anyone who can view the canvas reads them. */
export const listCanvasVersionsContract = oc
  .meta(openapi({ method: 'GET', path: '/canvases/{canvasId}/versions' }))
  .errors({ NOT_FOUND, VERSION_NOT_FOUND })
  .input(ListCanvasVersionsInputSchema)
  .output(CanvasVersionPageSchema);

export const getCanvasVersionContract = oc
  .meta(
    openapi({
      method: 'GET',
      path: '/canvases/{canvasId}/versions/{versionId}',
    })
  )
  .errors({ NOT_FOUND, VERSION_NOT_FOUND })
  .input(CanvasVersionInputSchema)
  .output(CanvasVersionSchema);

/** Saves the content as a named version, whenever the last one was. */
export const createCanvasVersionContract = oc
  .meta(openapi({ method: 'POST', path: '/canvases/{canvasId}/versions' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(CreateCanvasVersionInputSchema)
  .output(CanvasVersionSummarySchema);

/** Makes the version the canvas's content, keeping what it replaces as a version first. */
export const restoreCanvasVersionContract = oc
  .meta(
    openapi({
      method: 'POST',
      path: '/canvases/{canvasId}/versions/{versionId}/restore',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, VERSION_NOT_FOUND })
  .input(RestoreCanvasVersionInputSchema)
  .output(CanvasVersionRestoredSchema);
