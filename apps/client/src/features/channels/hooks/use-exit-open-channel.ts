'use client';

import { useParams, useRouter } from 'next/navigation';

/** Returns a function to call once a channel is gone for the viewer (left or deleted). If it is the open one, land on the default channel. */
export function useExitOpenChannel() {
  const router = useRouter();
  const { roomId: openChannelId } = useParams<{ roomId?: string }>();

  return (roomId: string) => {
    if (roomId === openChannelId) router.push('/');
  };
}
