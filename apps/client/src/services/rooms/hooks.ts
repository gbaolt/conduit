'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc';

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
