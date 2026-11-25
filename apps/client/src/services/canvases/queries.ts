import {
  CANVAS_EMBEDS_MAX,
  type CanvasScope,
  type EmbeddedMessage,
} from '@conduit/contract';
import { queryOptions } from '@tanstack/react-query';

import { client, orpc } from '@/lib/orpc';

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

/** Read once, when a canvas opens, to choose live or single-user editing. */
export const canvasLiveblocksAuthQuery = (canvasId: string) =>
  orpc.canvases.liveblocksAuth.queryOptions({
    input: { canvasId },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export const canvasCommentsQuery = (canvasId: string) =>
  orpc.canvases.listComments.queryOptions({ input: { canvasId } });

/** The canvas's versions, newest first, a page at a time. */
export const canvasVersionsQuery = (canvasId: string) =>
  orpc.canvases.listVersions.infiniteOptions({
    input: (cursor: string | undefined) => ({ canvasId, cursor }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** A saved version never changes, so it is read once. */
export const canvasVersionQuery = (canvasId: string, versionId: string) =>
  orpc.canvases.getVersion.queryOptions({
    input: { canvasId, versionId },
    staleTime: Infinity,
  });

type EmbedBatch = {
  canvasId: string;
  ids: Set<string>;
  result: Promise<Map<string, EmbeddedMessage>>;
};
let embedBatch: EmbedBatch | null = null;

// Every embed asking in the same tick shares one request.
function loadEmbeddedMessage(canvasId: string, messageId: string) {
  if (
    !embedBatch ||
    embedBatch.canvasId !== canvasId ||
    embedBatch.ids.size >= CANVAS_EMBEDS_MAX
  ) {
    const ids = new Set<string>();
    const result = Promise.resolve().then(async () => {
      if (embedBatch?.ids === ids) embedBatch = null;
      const list = await client.canvases.embeddedMessages({
        canvasId,
        messageIds: [...ids],
      });
      return new Map(list.map((each) => [each.messageId, each]));
    });
    embedBatch = { canvasId, ids, result };
  }
  embedBatch.ids.add(messageId);
  return embedBatch.result.then((found) => found.get(messageId)!);
}

/** One message a canvas embeds, as the viewer may see it. */
export const canvasEmbeddedMessageQuery = (
  canvasId: string,
  messageId: string
) =>
  queryOptions({
    queryKey: [
      ...orpc.canvases.embeddedMessages.key({ input: { canvasId } }),
      messageId,
    ],
    queryFn: () => loadEmbeddedMessage(canvasId, messageId),
  });
