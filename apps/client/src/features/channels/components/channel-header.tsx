'use client';

import { Button } from '@conduit/ui/components/button';
import { IconDots, IconHash, IconLock, IconUsers } from '@tabler/icons-react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useActivateChannelWorkspace } from '@/services/channels/hooks';
import { channelQuery } from '@/services/channels/queries';

import { useChannelDialogs } from '../context/channel-dialogs-provider';
import { ChannelActionsDropdown } from './channel-actions-menu';

export function ChannelHeader({ channelId }: { channelId: string }) {
  const { data: channel } = useSuspenseQuery(channelQuery(channelId));
  const { open } = useChannelDialogs();
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  useActivateChannelWorkspace(channelId, channel.organizationId);

  return (
    <>
      <header className="flex min-h-12 items-center gap-1.5 border-b px-4 py-1.5">
        <div className="min-w-0 flex-1">
          <h1 className="min-w-0 text-sm font-semibold">
            <Button
              variant="ghost"
              size="xs"
              className="max-w-full font-semibold"
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
        <Button
          variant="ghost"
          size="xs"
          aria-label={`${channel.memberCount} members`}
          onClick={() => open({ kind: 'details', channel, tab: 'members' })}
        >
          <IconUsers />
          {channel.memberCount}
        </Button>
        <ChannelActionsDropdown
          channel={channel}
          trigger={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Actions for #${channel.name}`}
            />
          }
        >
          <IconDots />
        </ChannelActionsDropdown>
      </header>
      <p className="text-muted-foreground p-4 text-sm">
        This is the very beginning of #{channel.name}.
      </p>
    </>
  );
}
