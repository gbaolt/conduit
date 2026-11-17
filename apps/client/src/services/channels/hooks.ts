'use client';

import {
  partialMatchKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc';
import { useOptimisticMembership } from '@/services/rooms/hooks';

function useInvalidateChannels() {
  const queryClient = useQueryClient();

  // A removed channel's own `get` is skipped: refetching it would throw NOT_FOUND into the page that is still showing it.
  return (removedChannelId?: string) => {
    const removedKey =
      removedChannelId &&
      orpc.rooms.get.key({ input: { roomId: removedChannelId } });

    const predicate = ({ queryKey }: { queryKey: readonly unknown[] }) =>
      !removedKey || !partialMatchKey(queryKey, removedKey);

    // A channel's own record and members live under `rooms`, beside the channel list.
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.channels.key(),
        predicate,
      }),
      queryClient.invalidateQueries({ queryKey: orpc.rooms.key(), predicate }),
    ]);
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
      onSuccess: (_, { roomId }) => invalidate(roomId),
    })
  );
}

export function useDeleteChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.delete.mutationOptions({
      onSuccess: (_, { roomId }) => invalidate(roomId),
    })
  );
}

export function useUpdateChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.update.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useAddChannelMembers() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.members.add.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useRemoveChannelMember() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.members.remove.mutationOptions({
      onSuccess: () => invalidate(),
    })
  );
}

export function useSetChannelMemberRole() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.members.setRole.mutationOptions({
      onSuccess: () => invalidate(),
    })
  );
}

export function useArchiveChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.archive.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useUnarchiveChannel() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.unarchive.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useSetChannelVisibility() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.setVisibility.mutationOptions({
      onSuccess: () => invalidate(),
    })
  );
}

export function useSetChannelPermissions() {
  const invalidate = useInvalidateChannels();

  return useMutation(
    orpc.channels.setPermissions.mutationOptions({
      onSuccess: () => invalidate(),
    })
  );
}

export function useMoveChannelToSection() {
  return useMutation(
    orpc.channels.moveToSection.mutationOptions(
      useOptimisticMembership(
        ({
          roomId,
          sectionId,
        }: {
          roomId: string;
          sectionId: string | null;
        }) => ({ roomIds: [roomId], patch: { sectionId } })
      )
    )
  );
}

function useInvalidateSections() {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.channelSections.key() });
}

export function useCreateChannelSection() {
  const invalidate = useInvalidateSections();

  return useMutation(
    orpc.channelSections.create.mutationOptions({ onSuccess: invalidate })
  );
}

export function useRenameChannelSection() {
  const invalidate = useInvalidateSections();

  return useMutation(
    orpc.channelSections.rename.mutationOptions({ onSuccess: invalidate })
  );
}

export function useReorderChannelSections() {
  const invalidate = useInvalidateSections();

  return useMutation(
    orpc.channelSections.reorder.mutationOptions({
      onSettled: invalidate,
      onError: (error) => toast.error(error.message),
    })
  );
}

export function useDeleteChannelSection() {
  const invalidate = useInvalidateSections();
  const invalidateChannels = useInvalidateChannels();

  // The server moves the section's channels back to Channels, so the channel list is stale too.
  return useMutation(
    orpc.channelSections.delete.mutationOptions({
      onSuccess: () => Promise.all([invalidate(), invalidateChannels()]),
    })
  );
}
