'use client';

import { canChannel } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { useSuspenseQuery } from '@tanstack/react-query';

import { channelQuery } from '@/services/channels/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../context/channel-dialogs-provider';

/** The first thing in a channel's log, above its first message. */
export function ChannelIntro({ channelId }: { channelId: string }) {
  const { data: channel } = useSuspenseQuery(channelQuery(channelId));
  const { open } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();

  return (
    <section className="px-5 pt-6 pb-4">
      <h2 className="text-xl font-semibold">
        This is the very beginning of #{channel.name}
      </h2>
      {channel.description && (
        <p className="text-muted-foreground mt-1 text-sm">
          {channel.description}
        </p>
      )}
      {canChannel('addMembers', workspaceRole, channel) && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => open({ kind: 'add-members', channel })}
        >
          Add people
        </Button>
      )}
    </section>
  );
}
