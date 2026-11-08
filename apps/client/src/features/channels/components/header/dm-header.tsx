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

import { BackToList } from '@/components/list-view';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/channels/dm-title';
import { useActivateChannelWorkspace, useDm } from '@/services/channels/hooks';
import { channelQuery } from '@/services/channels/queries';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';

/** The bar above a DM: who it is with, and the menu that adds people or turns it into a channel. */
export function DmHeader({
  channelId,
  children,
  menu,
}: {
  channelId: string;
  /** Buttons that other features add before the menu, such as the pinned list. */
  children?: ReactNode;
  /** Rows that other features add to the menu, such as Summarize conversation. */
  menu?: ReactNode;
}) {
  const { data: channel } = useSuspenseQuery(channelQuery(channelId));
  const { data: session } = useQuery(sessionQuery);
  const { open } = useChannelDialogs();
  const dm = useDm(channelId);
  useActivateChannelWorkspace(channelId, channel.organizationId);

  const title = dm ? dmTitle(dm, session?.user.id ?? '') : 'Direct message';
  const count = dm?.members.length ?? 0;

  return (
    <header className="flex min-h-12 shrink-0 items-center gap-1.5 border-b px-4 py-1.5">
      <BackToList />
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
            onClick={() => open({ kind: 'dm-add-people', channelId })}
          >
            <IconUserPlus />
            Add people
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => open({ kind: 'dm-convert', channelId })}
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
