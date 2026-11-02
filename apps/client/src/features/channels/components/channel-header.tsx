'use client';

import { IconHash, IconLock } from '@tabler/icons-react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useActivateChannelWorkspace } from '@/services/channels/hooks';
import { channelQuery } from '@/services/channels/queries';

export function ChannelHeader({ channelId }: { channelId: string }) {
  const { data: channel } = useSuspenseQuery(channelQuery(channelId));
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  useActivateChannelWorkspace(channel.organizationId);

  return (
    <>
      <header className="flex h-12 items-center gap-1.5 border-b px-4">
        <Glyph className="size-4 shrink-0" />
        <h1 className="truncate text-sm font-semibold">{channel.name}</h1>
      </header>
      <p className="text-muted-foreground p-4 text-sm">
        This is the very beginning of #{channel.name}.
      </p>
    </>
  );
}
