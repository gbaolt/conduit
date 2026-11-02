'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { channelsQuery } from '@/services/channels/queries';

export function DefaultChannelRedirect() {
  const router = useRouter();
  const { data: channels } = useQuery(channelsQuery);
  const defaultChannelId = channels?.find((channel) => channel.isDefault)?.id;

  useEffect(() => {
    if (defaultChannelId) router.replace(`/channels/${defaultChannelId}`);
  }, [defaultChannelId, router]);

  return null;
}
