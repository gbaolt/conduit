'use client';

import type { Room } from '@conduit/contract';
import {
  partialMatchKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { orpc } from '@/lib/orpc';
import { sessionQuery } from '@/services/auth/queries';
import { useSwitchWorkspace } from '@/services/workspaces/hooks';

import { dmTitle } from './dm-title';
import { channelsQuery, dmsQuery, roomQuery } from './queries';

/** A channel link can point into another workspace the viewer belongs to: make that workspace active, once per channel. */
export function useActivateChannelWorkspace(
  roomId: string,
  organizationId: string
) {
  const { activeWorkspace, isPending } = useWorkspace();
  const { mutate: switchWorkspace } = useSwitchWorkspace();
  const checkedChannelId = useRef<string | null>(null);
  const activeId = activeWorkspace?.id;

  useEffect(() => {
    // An empty active workspace is WorkspaceProvider's job to fill.
    if (isPending || !activeId || checkedChannelId.current === roomId) {
      return;
    }

    // Checked once per channel, so a later manual workspace switch is not undone.
    checkedChannelId.current = roomId;
    if (activeId !== organizationId) switchWorkspace(organizationId);
  }, [activeId, roomId, isPending, organizationId, switchWorkspace]);
}

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

type Membership = NonNullable<Room['membership']>;

/** Per-user state can't conflict, so the cache moves first and rolls back if the server refuses. */
function useOptimisticMembership<TInput extends { roomId: string }>(
  patchOf: (input: TInput) => Partial<Membership>
) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateChannels();
  const { queryKey } = channelsQuery;

  return {
    onMutate: async (input: TInput) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (channels) =>
        channels?.map((channel) =>
          channel.id === input.roomId && channel.membership
            ? {
                ...channel,
                membership: { ...channel.membership, ...patchOf(input) },
              }
            : channel
        )
      );
      return { previous };
    },
    onError: (
      error: Error,
      _input: TInput,
      context: { previous: Room[] | undefined } | undefined
    ) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(error.message);
    },
    onSettled: () => invalidate(),
  };
}

export function useStarChannel() {
  return useMutation(
    orpc.channels.star.mutationOptions(
      useOptimisticMembership(() => ({ starredAt: new Date() }))
    )
  );
}

export function useUnstarChannel() {
  return useMutation(
    orpc.channels.unstar.mutationOptions(
      useOptimisticMembership(() => ({ starredAt: null }))
    )
  );
}

export function useMoveChannelToSection() {
  return useMutation(
    orpc.channels.moveToSection.mutationOptions(
      useOptimisticMembership(
        ({ sectionId }: { roomId: string; sectionId: string | null }) => ({
          sectionId,
        })
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

function useInvalidateDms() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: orpc.dms.key() });
}

export function useOpenDm() {
  const invalidate = useInvalidateDms();

  return useMutation(
    orpc.dms.open.mutationOptions({ onSuccess: () => invalidate() })
  );
}

export function useAddDmPeople() {
  const invalidate = useInvalidateDms();

  return useMutation(
    orpc.dms.addPeople.mutationOptions({ onSuccess: () => invalidate() })
  );
}

/** The DM leaves the DM list and joins the channel list. */
export function useConvertDm() {
  const invalidateDms = useInvalidateDms();
  const invalidateChannels = useInvalidateChannels();

  return useMutation(
    orpc.dms.convertToChannel.mutationOptions({
      onSuccess: () => Promise.all([invalidateDms(), invalidateChannels()]),
    })
  );
}

/** The viewer's DM with this channel id, once the DM list has loaded. */
export function useDm(roomId: string) {
  const { data: dms } = useQuery(dmsQuery);
  return dms?.find((dm) => dm.id === roomId);
}

/** What a conversation is called: "#design", "Linh, Bao", or "Bao Le (you)". Empty until the channel loads. */
export function useRoomName(roomId: string) {
  const { data: channel } = useQuery(roomQuery(roomId));
  const isDm = channel?.kind === 'dm';
  const { data: dms } = useQuery({ ...dmsQuery, enabled: isDm });
  const { data: session } = useQuery(sessionQuery);

  if (!channel) return { title: '', isDm: false, isSelf: false };
  if (!isDm) return { title: `#${channel.name}`, isDm: false, isSelf: false };

  const dm = dms?.find((item) => item.id === roomId);
  return {
    title: dm ? dmTitle(dm, session?.user.id ?? '') : 'Direct message',
    isDm: true,
    isSelf: dm?.members.length === 1,
  };
}
