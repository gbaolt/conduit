'use client';

import { useQuery } from '@tanstack/react-query';

import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { useDm } from '@/services/dms/hooks';

/** Who a DM is with, from the sidebar's DM list, or nothing when the list does not hold it. */
export function DmName({ roomId }: { roomId: string }) {
  const dm = useDm(roomId);
  const { data: session } = useQuery(sessionQuery);
  return dm ? dmTitle(dm, session?.user.id ?? '') : null;
}
