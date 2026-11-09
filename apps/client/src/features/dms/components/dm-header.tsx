'use client';

import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { IconDots, IconUserPlus, IconUsers } from '@tabler/icons-react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ListBackLink } from '@/components/list-view';
import { useActivateRoomWorkspace } from '@/features/rooms/lib/use-activate-room-workspace';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { useDm } from '@/services/dms/hooks';
import { roomQuery } from '@/services/rooms/queries';

import { useDmDialogs } from '../context/dm-dialogs-provider';

/** The bar above a DM: who it is with, and the menu that adds people or turns it into a channel. */
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
    <header className="flex min-h-12 shrink-0 items-center gap-1.5 border-b px-4 py-1.5">
      <ListBackLink />
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
      {children}
      {count > 1 && (
        <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
          <IconUsers className="size-3.5" aria-hidden />
          {count}
          <span className="sr-only">people</span>
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Conversation actions"
            />
          }
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            onClick={() => open({ kind: 'dm-add-people', roomId })}
          >
            <IconUserPlus />
            Add people
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => open({ kind: 'dm-convert', roomId })}
          >
            <IconUsers />
            Turn into a private channel
          </DropdownMenuItem>
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
