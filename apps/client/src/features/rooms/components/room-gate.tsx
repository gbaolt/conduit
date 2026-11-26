'use client';

import type { RoomKind } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { IconCloudOff, IconLockQuestion } from '@tabler/icons-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ListBackLink } from '@/components/list-view';
import { draftQuery } from '@/services/activity/queries';
import { roomCanvasesQuery } from '@/services/canvases/queries';
import { messagesQuery } from '@/services/messages/queries';
import { roomQuery } from '@/services/rooms/queries';

import { roomGateState } from '../lib/room-gate';
import { RoomPageSkeleton } from './room-skeletons';

/**
 * Loads the room in the browser and renders `children` once it has it, so the page needs nothing from the
 * server and a room the browser holds opens at once. Children may read `roomQuery` with suspense: it is in
 * the cache by then. A room that cannot load keeps the page and says why, with `title` from the sidebar.
 */
export function RoomGate({
  roomId,
  kind,
  title,
  children,
}: {
  roomId: string;
  kind: RoomKind;
  /** The room's name from data the sidebar already holds, for when the room itself cannot load. */
  title: ReactNode;
  children: ReactNode;
}) {
  const query = useQuery(roomQuery(roomId));
  const state = roomGateState(
    kind,
    query.data,
    query.error ?? query.failureReason
  );
  const canLoadRoomData =
    state.status === 'loading' || state.status === 'ready';
  // Start messages, draft, and room canvases in parallel with roomQuery so unseeded rooms (such as DMs and direct channel links) do not waterfall.
  useInfiniteQuery({ ...messagesQuery(roomId), enabled: canLoadRoomData });
  useQuery({ ...draftQuery(roomId), enabled: canLoadRoomData });
  useQuery({ ...roomCanvasesQuery(roomId), enabled: canLoadRoomData });

  switch (state.status) {
    case 'ready':
      return children;
    case 'moved':
      return redirect(state.href);
    case 'loading':
      return <RoomPageSkeleton />;
    case 'missing':
      return (
        <RoomUnavailable title={title} icon={<IconLockQuestion />}>
          <EmptyTitle>This conversation isn’t available</EmptyTitle>
          <EmptyDescription>
            It was deleted, or you no longer have access to it.
          </EmptyDescription>
        </RoomUnavailable>
      );
    case 'failed':
      return (
        <RoomUnavailable
          title={title}
          icon={<IconCloudOff />}
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          <EmptyTitle>Couldn’t open this conversation</EmptyTitle>
          <EmptyDescription>
            {query.isFetching
              ? 'Trying again…'
              : 'Nothing is lost. Try again in a moment.'}
          </EmptyDescription>
        </RoomUnavailable>
      );
  }
}

function RoomUnavailable({
  title,
  icon,
  action,
  children,
}: {
  title: ReactNode;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 items-center gap-1.5 border-b px-4 py-1.5">
        <ListBackLink />
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </h1>
      </header>
      <Empty className="flex-1 border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          {children}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}
