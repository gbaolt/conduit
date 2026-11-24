import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  CanvasDocumentSchema,
  CanvasIdInputSchema,
  CanvasMemberInputSchema,
  CanvasMemberSchema,
  CanvasSchema,
  CreateCanvasInputSchema,
  ListCanvasesInputSchema,
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
} as const;

const { NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, LAST_EDITOR, NOT_A_MEMBER } =
  canvasErrors;

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
