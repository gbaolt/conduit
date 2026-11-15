'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';

import { ListDesktopRedirect } from '@/components/list-view';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import { channelsQuery } from '@/services/channels/queries';

/**
 * Opens the default channel. A phone stays on `/`, where the channel list fills the screen. Until the channel
 * opens, the page keeps the room skeleton the layout showed, so it never goes blank.
 */
export function DefaultChannelRedirect() {
  const { data: channels } = useQuery(channelsQuery);
  const defaultChannelId = channels?.find((channel) => channel.isDefault)?.id;

  return (
    <>
      {defaultChannelId && (
        <ListDesktopRedirect href={`/channels/${defaultChannelId}` as Route} />
      )}
      <RoomPageSkeleton />
    </>
  );
}
