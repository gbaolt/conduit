import type { CanvasScope } from '@conduit/contract';

import { orpc } from '@/lib/orpc';

/** The channel's canvas, or null before anyone creates it. */
export const channelCanvasQuery = (roomId: string) =>
  orpc.canvases.getChannelCanvas.queryOptions({ input: { roomId } });

export const canvasesQuery = (scope: CanvasScope) =>
  orpc.canvases.list.queryOptions({ input: { scope } });

/** A canvas the viewer cannot read answers NOT_FOUND, which retrying never changes. */
export const canvasQuery = (canvasId: string) =>
  orpc.canvases.get.queryOptions({ input: { canvasId }, retry: false });

export const canvasMembersQuery = (canvasId: string) =>
  orpc.canvases.listMembers.queryOptions({ input: { canvasId } });
