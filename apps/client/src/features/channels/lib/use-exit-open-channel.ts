'use client';

import { useParams, useRouter } from 'next/navigation';

/** Returns a function to call once a channel is gone for the viewer (left or deleted). If it is the open one, land on the default channel. */
export function useExitOpenChannel() {
  const router = useRouter();
  const { channelId: openChannelId } = useParams<{ channelId?: string }>();

  return (channelId: string) => {
    if (channelId === openChannelId) router.push('/');
  };
}
