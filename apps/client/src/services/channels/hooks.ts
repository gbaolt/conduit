'use client';

import {
  partialMatchKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { orpc } from '@/lib/orpc';
import { useSwitchWorkspace } from '@/services/workspaces/hooks';

/** A channel link can point into another workspace the viewer belongs to: make that workspace active, once per channel. */
export function useActivateChannelWorkspace(
  channelId: string,
  organizationId: string
) {
  const { activeWorkspace, isPending } = useWorkspace();
  const { mutate: switchWorkspace } = useSwitchWorkspace();
  const checkedChannelId = useRef<string | null>(null);
  const activeId = activeWorkspace?.id;

  useEffect(() => {
    // An empty active workspace is WorkspaceProvider's job to fill.
    if (isPending || !activeId || checkedChannelId.current === channelId) {
      return;
    }

    // Checked once per channel, so a later manual workspace switch is not undone.
    checkedChannelId.current = channelId;
    if (activeId !== organizationId) switchWorkspace(organizationId);
  }, [activeId, channelId, isPending, organizationId, switchWorkspace]);
}

function useInvalidateChannels() {
  const queryClient = useQueryClient();

  // A removed channel's own `get` is skipped: refetching it would throw NOT_FOUND into the page that is still showing it.
  return (removedChannelId?: string) => {
    const removedKey =
      removedChannelId &&
      orpc.channels.get.key({ input: { channelId: removedChannelId } });

    return queryClient.invalidateQueries({
      queryKey: orpc.channels.key(),
      predicate: ({ queryKey }) =>
        !removedKey || !partialMatchKey(queryKey, removedKey),
    });
  };
}

export function useCreateChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.create.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useRenameChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.rename.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useJoinChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.join.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useLeaveChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.leave.mutationOptions({
      onSuccess: (_, { channelId }) => invalidate(channelId),
    })
  );
}

export function useDeleteChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.delete.mutationOptions({
      onSuccess: (_, { channelId }) => invalidate(channelId),
    })
  );
}
