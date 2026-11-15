'use client';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { IconMessage } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';

import { ListDesktopRedirect } from '@/components/list-view';
import { RoomPageSkeleton } from '@/features/rooms/components/room-skeletons';
import { dmsQuery } from '@/services/dms/queries';

/**
 * Opens the newest DM. A phone stays on `/dms`, where the DM list fills the screen. With no DMs yet, the
 * page says so beside the list's New message button.
 */
export function LatestDmRedirect() {
  // The list comes newest first.
  const { data: dms } = useQuery(dmsQuery);
  const latestId = dms?.[0]?.id;

  // Until the DM opens, the page keeps the room skeleton the layout showed, so it never goes blank.
  if (latestId)
    return (
      <>
        <ListDesktopRedirect href={`/dms/${latestId}` as Route} />
        <RoomPageSkeleton />
      </>
    );
  if (!dms) return <RoomPageSkeleton />;

  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconMessage />
        </EmptyMedia>
        <EmptyTitle>Your direct messages</EmptyTitle>
        <EmptyDescription>
          Conversations with one person or a small group show up here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
