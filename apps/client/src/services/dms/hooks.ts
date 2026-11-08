'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc';

import { dmsQuery } from './queries';

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
  const queryClient = useQueryClient();

  return useMutation(
    orpc.dms.convertToChannel.mutationOptions({
      onSuccess: () =>
        Promise.all([
          invalidateDms(),
          queryClient.invalidateQueries({ queryKey: orpc.channels.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.rooms.key() }),
        ]),
    })
  );
}

/** The viewer's DM with this channel id, once the DM list has loaded. */
export function useDm(roomId: string) {
  const { data: dms } = useQuery(dmsQuery);
  return dms?.find((dm) => dm.id === roomId);
}
