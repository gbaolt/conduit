'use client';

import type {
  Canvas,
  SaveCanvasSnapshotInput,
  UpdateCanvasInput,
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
          // Added at once, so the new tab can open even if the refetch below fails.
          queryClient.setQueryData(
            orpc.canvases.listRoomCanvases.queryKey({
              input: { roomId: canvas.roomId },
            }),
            (tabs) =>
              tabs && !tabs.some((tab) => tab.id === canvas.id)
                ? [...tabs, canvas]
                : tabs
          );
          void queryClient.invalidateQueries({
            queryKey: orpc.canvases.listRoomCanvases.key({
              input: { roomId: canvas.roomId },
            }),
          });
        }
        return queryClient.invalidateQueries({
          queryKey: orpc.canvases.list.key(),
        });
      },
    })
  );
}

/**
 * Merges a `canvases.update` response into a cached canvas without letting a slower
 * response (such as an autosave) overwrite fields changed by a concurrent update.
 */
export function applyCanvasUpdate<T extends Canvas>(
  old: T,
  response: Canvas,
  variables: UpdateCanvasInput
): T {
  return {
    ...old,
    updatedAt: response.updatedAt,
    updatedByName: response.updatedByName,
    access: response.access,
    ...(variables.title !== undefined && { title: response.title }),
    ...(variables.icon !== undefined && { icon: response.icon }),
    ...(variables.coverPreset !== undefined && {
      coverPreset: response.coverPreset,
    }),
    ...('snapshotJson' in old &&
      variables.snapshotJson !== undefined && {
        snapshotJson: variables.snapshotJson,
      }),
    ...('markdown' in old &&
      variables.markdown !== undefined && { markdown: variables.markdown }),
  };
}

/**
 * Saves edits. The open editor already shows them, so the cached document is patched in place rather than
 * refetched, and reopening the canvas starts from what was saved.
 */
export function useUpdateCanvas() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.canvases.update.mutationOptions({
      onSuccess: (canvas, variables) => {
        queryClient.setQueryData(
          orpc.canvases.get.queryKey({ input: { canvasId: canvas.id } }),
          (old) => old && applyCanvasUpdate(old, canvas, variables)
        );
        // Autosaves run every second while typing, so the tabs are patched rather than refetched.
        if (canvas.roomId) {
          queryClient.setQueryData(
            orpc.canvases.listRoomCanvases.queryKey({
              input: { roomId: canvas.roomId },
            }),
            (tabs) =>
              tabs?.map((tab) =>
                tab.id === canvas.id
                  ? applyCanvasUpdate(tab, canvas, variables)
                  : tab
              )
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
            queryKey: orpc.canvases.listRoomCanvases.key(),
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

/** The canvas edits still saving, read when called, so a click sees the save its own blur just started. */
export function usePendingCanvasUpdates() {
  const queryClient = useQueryClient();
  return () =>
    queryClient
      .getMutationCache()
      .findAll({
        mutationKey: orpc.canvases.update.mutationKey(),
        status: 'pending',
      })
      .map((mutation) => mutation.state.variables as UpdateCanvasInput);
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

/** Refetches the version list, as when someone else on a live canvas saves or restores a version. */
export function useInvalidateCanvasVersions() {
  const queryClient = useQueryClient();

  return ({ canvasId }: { canvasId: string }) =>
    queryClient.invalidateQueries({
      queryKey: orpc.canvases.listVersions.key({ input: { canvasId } }),
    });
}

export function useCreateCanvasVersion() {
  const invalidate = useInvalidateCanvasVersions();
  return useMutation(
    orpc.canvases.createVersion.mutationOptions({
      onSuccess: (_, input) => invalidate(input),
    })
  );
}

/** The restored content arrives in the open editor, so the cached document is replaced rather than refetched. */
export function useRestoreCanvasVersion() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCanvasVersions();

  return useMutation(
    orpc.canvases.restoreVersion.mutationOptions({
      onSuccess: ({ canvas }, input) => {
        queryClient.setQueryData(
          orpc.canvases.get.queryKey({ input: { canvasId: canvas.id } }),
          canvas
        );
        return Promise.all([
          invalidate(input),
          queryClient.invalidateQueries({ queryKey: orpc.canvases.list.key() }),
        ]);
      },
    })
  );
}
