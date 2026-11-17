'use client';

import type { RoomMembership, SidebarEntry } from '@conduit/contract';
import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc';
import { sidebarStateQuery } from '@/services/activity/queries';

/** A room's level and mute state ride on its `membership`, which the room record, channel list, and DM list all carry. */
function useRefreshMembership() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all(
      [orpc.rooms.key(), orpc.channels.key(), orpc.dms.key()].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey })
      )
    );
}

// mutate, not mutateAsync: the menu closes on click, so the toast lives on the hook, not on a call.
function useMembershipMutation() {
  const refresh = useRefreshMembership();

  return {
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  };
}

type WithMembership = { id: string; membership: RoomMembership | null };

/**
 * Per-user state can't conflict, so the caches move first and roll back if the server refuses. The membership
 * rides on every channel list and on the DM list, so one patch moves them all.
 */
export function useOptimisticMembership<TInput>(
  patchOf: (input: TInput) => {
    roomIds: string[];
    patch: Partial<RoomMembership>;
  }
) {
  const queryClient = useQueryClient();
  const refresh = useRefreshMembership();
  const listKeys = [orpc.channels.list.key(), orpc.dms.list.key()];

  return {
    onMutate: async (input: TInput) => {
      await Promise.all(
        listKeys.map((queryKey) => queryClient.cancelQueries({ queryKey }))
      );
      const previous = listKeys.flatMap((queryKey) =>
        queryClient.getQueriesData<WithMembership[]>({ queryKey })
      );
      const { roomIds, patch } = patchOf(input);
      for (const queryKey of listKeys) {
        queryClient.setQueriesData<WithMembership[]>({ queryKey }, (rooms) =>
          rooms?.map((room) =>
            roomIds.includes(room.id) && room.membership
              ? { ...room, membership: { ...room.membership, ...patch } }
              : room
          )
        );
      }
      return { previous };
    },
    onError: (
      error: Error,
      _input: TInput,
      context:
        | { previous: [QueryKey, WithMembership[] | undefined][] }
        | undefined
    ) => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(error.message);
    },
    onSettled: refresh,
  };
}

export function useStarRoom() {
  return useMutation(
    orpc.rooms.star.mutationOptions(
      useOptimisticMembership(({ roomId }) => ({
        roomIds: [roomId],
        patch: { starredAt: new Date() },
      }))
    )
  );
}

export function useUnstarRoom() {
  return useMutation(
    orpc.rooms.unstar.mutationOptions(
      useOptimisticMembership(({ roomId }) => ({
        roomIds: [roomId],
        patch: { starredAt: null },
      }))
    )
  );
}

/**
 * Marks rooms read through their latest message. The dots clear at once: the sidebar stream's rows are the
 * unread state, and its next result replaces this patch with the server's.
 */
export function useMarkRoomsRead() {
  const queryClient = useQueryClient();
  const { queryKey } = sidebarStateQuery;

  return useMutation(
    orpc.readState.markRooms.mutationOptions({
      onMutate: ({ roomIds }) => {
        const previous = queryClient.getQueryData<SidebarEntry[]>(queryKey);
        const marked = new Set(roomIds);
        queryClient.setQueryData<SidebarEntry[]>(queryKey, (rows) =>
          rows?.map((row) =>
            marked.has(row.roomId) && row.lastMessageAt
              ? { ...row, lastReadAt: row.lastMessageAt }
              : row
          )
        );
        return { previous };
      },
      onError: (error, _input, context) => {
        queryClient.setQueryData(queryKey, context?.previous);
        toast.error(error.message);
      },
    })
  );
}

export function useSetRoomNotify() {
  return useMutation(
    orpc.rooms.setNotify.mutationOptions(useMembershipMutation())
  );
}

export function useMuteRoom() {
  return useMutation(orpc.rooms.mute.mutationOptions(useMembershipMutation()));
}

export function useUnmuteRoom() {
  return useMutation(
    orpc.rooms.unmute.mutationOptions(useMembershipMutation())
  );
}
