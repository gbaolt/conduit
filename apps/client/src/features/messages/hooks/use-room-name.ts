'use client';

import { useQuery } from '@tanstack/react-query';

import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { dmsQuery } from '@/services/dms/queries';
import { roomQuery } from '@/services/rooms/queries';

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
