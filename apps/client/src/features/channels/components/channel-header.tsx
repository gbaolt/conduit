'use client';

import { Button } from '@conduit/ui/components/button';
import { IconDots, IconHash, IconLock, IconUsers } from '@tabler/icons-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { BackToList } from '@/components/list-view';
import { useActivateChannelWorkspace } from '@/services/channels/hooks';
import { channelQuery } from '@/services/channels/queries';

import { useChannelDialogs } from '../context/channel-dialogs-provider';
import { ArchivedBanner } from './archived-banner';
import { ChannelActionsDropdown } from './channel-actions-menu';

export function ChannelHeader({
  channelId,
  children,
  menu,
}: {
  channelId: string;
  /** Buttons that other features add before the member count, such as the pinned list. */
  children?: ReactNode;
  /** Rows that other features add to the actions menu, such as Summarize channel. */
  menu?: ReactNode;
}) {
  const { data: channel } = useSuspenseQuery(channelQuery(channelId));
  const { open } = useChannelDialogs();
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  useActivateChannelWorkspace(channelId, channel.organizationId);

  return (
    <>
      <header className="flex min-h-12 shrink-0 items-center gap-1.5 border-b px-2">
        <BackToList />
        <div className="min-w-0 flex-1">
          <h1 className="min-w-0 text-sm font-semibold">
            <Button
              variant="ghost"
              size="sm"
              className="max-w-full text-base font-semibold"
              onClick={() => open({ kind: 'details', channel })}
            >
              <Glyph />
              <span className="truncate">{channel.name}</span>
            </Button>
          </h1>
          {channel.topic && (
            <p className="text-muted-foreground truncate px-2 text-xs">
              {channel.topic}
            </p>
          )}
        </div>
        {children}
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${channel.memberCount} members`}
          onClick={() => open({ kind: 'details', channel, tab: 'members' })}
        >
          <IconUsers />
          {channel.memberCount}
        </Button>
        <ChannelActionsDropdown
          channel={channel}
          extra={menu}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for #${channel.name}`}
            />
          }
        >
          <IconDots />
        </ChannelActionsDropdown>
      </header>
      <ArchivedBanner channel={channel} />
    </>
  );
}
