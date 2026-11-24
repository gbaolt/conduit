'use client';

import type {
  CanvasDocument,
  SaveCanvasSnapshotInput,
} from '@conduit/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client, orpc } from '@/lib/orpc';

export function useCreateCanvas() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.canvases.create.mutationOptions({
      onSuccess: (canvas) => {
        queryClient.setQueryData(
          orpc.canvases.get.queryKey({ input: { canvasId: canvas.id } }),
          canvas
        );
        if (canvas.roomId) {
          queryClient.setQueryData(
            orpc.canvases.getChannelCanvas.queryKey({
              input: { roomId: canvas.roomId },
            }),
            canvas
          );
        }
        return queryClient.invalidateQueries({
          queryKey: orpc.canvases.list.key(),
        });
      },
    })
  );
}

/**
 * Saves edits. The open editor already shows them, so the cached document is patched in place rather than
 * refetched, and reopening the canvas starts from what was saved.
 */
export function useUpdateCanvas() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.canvases.update.mutationOptions({
      onSuccess: (canvas, { snapshotJson, markdown }) => {
        const patch = <T extends CanvasDocument | null | undefined>(old: T) =>
          (old && {
            ...old,
            ...canvas,
            snapshotJson: snapshotJson ?? old.snapshotJson,
            markdown: markdown ?? old.markdown,
          }) as T;
        queryClient.setQueryData(
          orpc.canvases.get.queryKey({ input: { canvasId: canvas.id } }),
          patch
        );
        if (canvas.roomId) {
          queryClient.setQueryData(
            orpc.canvases.getChannelCanvas.queryKey({
              input: { roomId: canvas.roomId },
            }),
            patch
          );
        }
        return queryClient.invalidateQueries({
          queryKey: orpc.canvases.list.key(),
        });
      },
    })
  );
}

/** A fresh Liveblocks token, apart from the query that decided live mode, so a failed refresh leaves the canvas open. */
export function useCanvasLiveblocksToken() {
  return useMutation(orpc.canvases.liveblocksAuth.mutationOptions());
}

export function useClaimCanvasBootstrap() {
  return useMutation(orpc.canvases.claimBootstrap.mutationOptions());
}

/**
 * Mirrors a live canvas into Postgres. The live document is what editors open, so no cached document is patched.
 * `keepalive` lets a small save finish after the page closes.
 */
export function useSaveCanvasSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      keepalive,
      ...input
    }: SaveCanvasSnapshotInput & { keepalive?: boolean }) =>
      client.canvases.saveSnapshot(input, { context: { keepalive } }),
    onSuccess: ({ saved }) =>
      saved &&
      queryClient.invalidateQueries({ queryKey: orpc.canvases.list.key() }),
  });
}

export function useDeleteCanvas() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.canvases.delete.mutationOptions({
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.canvases.list.key() }),
          queryClient.invalidateQueries({
            queryKey: orpc.canvases.getChannelCanvas.key(),
          }),
        ]),
    })
  );
}

function useInvalidateMembers() {
  const queryClient = useQueryClient();

  return ({ canvasId }: { canvasId: string }) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.canvases.listMembers.key({ input: { canvasId } }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.canvases.get.key({ input: { canvasId } }),
      }),
      queryClient.invalidateQueries({ queryKey: orpc.canvases.list.key() }),
    ]);
}

export function useShareCanvas() {
  const invalidate = useInvalidateMembers();

  return useMutation(
    orpc.canvases.share.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

export function useUpdateCanvasMemberRole() {
  const invalidate = useInvalidateMembers();

  return useMutation(
    orpc.canvases.updateMemberRole.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

export function useRemoveCanvasMember() {
  const invalidate = useInvalidateMembers();

  return useMutation(
    orpc.canvases.removeMember.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

/** Refetches the canvas's threads after a change, so the panel and the open-thread count agree with the server. */
function useInvalidateComments() {
  const queryClient = useQueryClient();

  return ({ canvasId }: { canvasId: string }) =>
    queryClient.invalidateQueries({
      queryKey: orpc.canvases.listComments.key({ input: { canvasId } }),
    });
}

export function useCreateCanvasCommentThread() {
  const invalidate = useInvalidateComments();
  return useMutation(
    orpc.canvases.createCommentThread.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

export function useReplyCanvasComment() {
  const invalidate = useInvalidateComments();
  return useMutation(
    orpc.canvases.replyComment.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

export function useEditCanvasComment() {
  const invalidate = useInvalidateComments();
  return useMutation(
    orpc.canvases.editComment.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

export function useDeleteCanvasComment() {
  const invalidate = useInvalidateComments();
  return useMutation(
    orpc.canvases.deleteComment.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

export function useResolveCanvasCommentThread() {
  const invalidate = useInvalidateComments();
  return useMutation(
    orpc.canvases.resolveCommentThread.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}
