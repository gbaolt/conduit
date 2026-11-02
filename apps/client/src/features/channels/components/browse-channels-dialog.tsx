'use client';

import { canChannel, type Channel } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { Input } from '@conduit/ui/components/input';
import { IconHash, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useJoinChannel } from '@/services/channels/hooks';
import { channelsQuery } from '@/services/channels/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../context/channel-dialogs-provider';

function BrowseChannelRow({ channel }: { channel: Channel }) {
  const router = useRouter();
  const { close } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const joinChannel = useJoinChannel();
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;
  const href = `/channels/${channel.id}` as const;

  return (
    <li className="flex items-center gap-2 py-1.5">
      <Glyph className="size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{channel.name}</p>
        <p className="text-muted-foreground text-xs">
          {channel.memberCount}{' '}
          {channel.memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>
      {channel.membership ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={href} onClick={close} />}
        >
          Open
        </Button>
      ) : (
        <StatusButton
          variant="outline"
          size="sm"
          disabled={!canChannel('join', workspaceRole, channel)}
          status={joinChannel.isPending ? 'loading' : 'idle'}
          onClick={() =>
            joinChannel.mutate(
              { channelId: channel.id },
              {
                onSuccess: () => {
                  close();
                  router.push(href);
                },
                onError: (error) => toast.error(error.message),
              }
            )
          }
        >
          Join
        </StatusButton>
      )}
    </li>
  );
}

export function BrowseChannelsDialog() {
  const { close } = useChannelDialogs();
  const { data: channels = [] } = useQuery(channelsQuery);
  const [filter, setFilter] = useState('');
  const needle = filter.trim().replace(/^#/, '').toLowerCase();
  const matches = channels
    .filter((channel) => channel.name.includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Browse channels</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          type="search"
          aria-label="Filter channels"
          placeholder="Filter channels"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        {matches.length ? (
          <ul className="max-h-72 overflow-y-auto">
            {matches.map((channel) => (
              <BrowseChannelRow key={channel.id} channel={channel} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No channels match.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
