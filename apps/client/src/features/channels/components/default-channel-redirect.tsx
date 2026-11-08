'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';

import { DesktopRedirect } from '@/components/list-view';
import { channelsQuery } from '@/services/channels/queries';

/** Opens the default channel. A phone stays on `/`, where the channel list fills the screen. */
export function DefaultChannelRedirect() {
  const { data: channels } = useQuery(channelsQuery);
  const defaultChannelId = channels?.find((channel) => channel.isDefault)?.id;

  return defaultChannelId ? (
    <DesktopRedirect href={`/channels/${defaultChannelId}` as Route} />
  ) : null;
}
