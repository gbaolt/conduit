'use client';

import { canChannel, type Room } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { IconArchive } from '@tabler/icons-react';
import { useSyncExternalStore } from 'react';

import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';

const subscribeNever = () => () => {};

export function ArchivedBanner({ channel }: { channel: Room }) {
  const { open } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();

  // The date renders only after hydration, in the viewer's own time zone; the server cannot know it.
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

  if (!channel.archivedAt) return null;

  const date =
    isClient &&
    channel.archivedAt.toLocaleDateString(undefined, { dateStyle: 'medium' });

  return (
    <div
      role="status"
      className="bg-muted flex items-center gap-2 border-b px-4 py-2 text-sm"
    >
      <IconArchive className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        This channel was archived
        {channel.archivedByName && ` by ${channel.archivedByName}`}
        {date && ` on ${date}`}.
      </p>
      {canChannel('unarchive', workspaceRole, channel) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => open({ kind: 'archive', channel })}
        >
          Unarchive
        </Button>
      )}
    </div>
  );
}
