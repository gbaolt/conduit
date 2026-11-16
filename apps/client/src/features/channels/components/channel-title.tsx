'use client';

import { useQuery } from '@tanstack/react-query';

import { channelsQuery } from '@/services/channels/queries';

/** "#name" from the sidebar's channel list, or nothing when the list does not hold the channel. */
export function ChannelTitle({ roomId }: { roomId: string }) {
  const { data: name } = useQuery({
    ...channelsQuery,
    select: (channels) =>
      channels.find((channel) => channel.id === roomId)?.name,
  });
  return name ? `#${name}` : null;
}
