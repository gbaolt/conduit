'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc';
import { isUnread, sidebarStateQuery } from '@/services/activity/queries';
import { useOptimisticMembership } from '@/services/rooms/hooks';

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

/** Closes DMs for the viewer only. A DM shows again once a message arrives after the close. */
export function useCloseDms() {
  return useMutation(
    orpc.dms.close.mutationOptions(
      useOptimisticMembership(({ roomIds }) => ({
        roomIds,
        patch: { closedAt: new Date() },
      }))
    )
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

/** How many DMs have messages the viewer has not read, leaving out muted ones and the one open now. */
export function useUnreadDmCount(openRoomId?: string) {
  const { data: dms } = useQuery(dmsQuery);

  return (
    useQuery({
      ...sidebarStateQuery,
      select: (rows) => {
        const ids = new Set(dms?.map((dm) => dm.id));
        return rows.filter(
          (row) =>
            ids.has(row.roomId) &&
            row.roomId !== openRoomId &&
            isUnread(row) &&
            !row.mutedAt
        ).length;
      },
    }).data ?? 0
  );
}
