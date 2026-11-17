'use client';

import { Button } from '@conduit/ui/components/button';
import { IconDots, IconUsers } from '@tabler/icons-react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ListBackLink } from '@/components/list-view';
import { RoomStarButton } from '@/features/rooms/components/room-star-button';
import { useActivateRoomWorkspace } from '@/features/rooms/hooks/use-activate-room-workspace';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { useDm } from '@/services/dms/hooks';
import { roomQuery } from '@/services/rooms/queries';

import { useDmDialogs } from '../context/dm-dialogs-provider';
import { DmActionsDropdown } from './actions/dm-actions';

/** The bar above a DM: who it is with, which opens its details, and the DM's actions menu. */
export function DmHeader({
  roomId,
  children,
  menu,
}: {
  roomId: string;
  /** Buttons that other features add before the menu, such as the pinned list. */
  children?: ReactNode;
  /** Rows that other features add to the menu, such as Summarize conversation. */
  menu?: ReactNode;
}) {
  const { data: channel } = useSuspenseQuery(roomQuery(roomId));
  const { data: session } = useQuery(sessionQuery);
  const { open } = useDmDialogs();
  const dm = useDm(roomId);
  useActivateRoomWorkspace(roomId, channel.organizationId);

  const title = dm ? dmTitle(dm, session?.user.id ?? '') : 'Direct message';
  const count = dm?.members.length ?? 0;

  return (
    <header className="flex min-h-12 shrink-0 items-center gap-1.5 border-b px-2">
      <ListBackLink />
      <RoomStarButton room={channel} />
      <h1 className="min-w-0 flex-1 text-sm font-semibold">
        <Button
          variant="ghost"
          size="sm"
          className="max-w-full text-base font-semibold"
          disabled={!dm}
          onClick={() => open({ kind: 'dm-details', roomId })}
        >
          <span className="truncate">{title}</span>
        </Button>
      </h1>
      {children}
      {count > 1 && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${count} people`}
          onClick={() => open({ kind: 'dm-details', roomId })}
        >
          <IconUsers />
          {count}
        </Button>
      )}
      {/* The menu reads the DM list's row, so it waits for the list. */}
      {dm && (
        <DmActionsDropdown
          dm={dm}
          extra={menu}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Conversation actions"
            />
          }
        >
          <IconDots />
        </DmActionsDropdown>
      )}
    </header>
  );
}
