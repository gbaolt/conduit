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

import { roomQuery } from './queries';

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
 * rides on every channel list, the DM list, and each room's own record, so one patch moves them all.
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
      const { roomIds, patch } = patchOf(input);
      const roomKeys = roomIds.map((roomId) => roomQuery(roomId).queryKey);
      const withPatch = <T extends WithMembership>(room: T) =>
        roomIds.includes(room.id) && room.membership
          ? { ...room, membership: { ...room.membership, ...patch } }
          : room;

      await Promise.all(
        [...listKeys, ...roomKeys].map((queryKey) =>
          queryClient.cancelQueries({ queryKey })
        )
      );
      const previous: [QueryKey, unknown][] = [
        ...listKeys.flatMap((queryKey) =>
          queryClient.getQueriesData({ queryKey })
        ),
        ...roomKeys.map(
          (queryKey) =>
            [queryKey, queryClient.getQueryData(queryKey)] as [
              QueryKey,
              unknown,
            ]
        ),
      ];
      for (const queryKey of listKeys) {
        queryClient.setQueriesData<WithMembership[]>({ queryKey }, (rooms) =>
          rooms?.map(withPatch)
        );
      }
      for (const queryKey of roomKeys) {
        queryClient.setQueryData(queryKey, (room) => room && withPatch(room));
      }
      return { previous };
    },
    onError: (
      error: Error,
      _input: TInput,
      context: { previous: [QueryKey, unknown][] } | undefined
    ) => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(error.message);
    },
    onSettled: refresh,
  };
}

/** Stars a room, with an Undo on the toast that confirms it. */
export function useStarRoom() {
  const { mutate: unstar } = useUnstarRoom();

  return useMutation(
    orpc.rooms.star.mutationOptions({
      ...useOptimisticMembership(({ roomId }: { roomId: string }) => ({
        roomIds: [roomId],
        patch: { starredAt: new Date() },
      })),
      onSuccess: (_data, { roomId }) => {
        toast.success('Added to Favorites', {
          action: { label: 'Undo', onClick: () => unstar({ roomId }) },
        });
      },
    })
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
