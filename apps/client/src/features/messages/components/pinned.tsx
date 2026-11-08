'use client';

import { canChannel } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { IconPin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { channelQuery } from '@/services/channels/queries';
import { useTogglePin } from '@/services/messages/hooks';
import { pinnedQuery } from '@/services/messages/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { MentionNames } from '../context/mention-names';
import { useAuthors } from '../lib/use-authors';
import { MessageExcerpt } from './message/message-excerpt';

const FORMER_MEMBER = { name: 'Former member', image: null };

/** The channel header's Pinned count, which opens the list. It renders nothing while no message is pinned. */
export function PinnedButton({ channelId }: { channelId: string }) {
  const { data: pinned } = useQuery(pinnedQuery(channelId));
  const [open, setOpen] = useState(false);

  if (!pinned?.length) return null;

  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        <IconPin />
        Pinned
        <span className="tabular-nums">{pinned.length}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80dvh] gap-3 overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pinned messages</DialogTitle>
            <DialogDescription>
              {pinned.length} {pinned.length === 1 ? 'message' : 'messages'}{' '}
              pinned to this channel.
            </DialogDescription>
          </DialogHeader>
          <PinnedList channelId={channelId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PinnedList({ channelId }: { channelId: string }) {
  const { data: pinned = [] } = useQuery(pinnedQuery(channelId));
  const { data: channel } = useQuery(channelQuery(channelId));
  const workspaceRole = useWorkspaceRole();
  const { authors, names } = useAuthors();
  const togglePin = useTogglePin(channelId);
  const canUnpin = channel ? canChannel('post', workspaceRole, channel) : false;

  return (
    <MentionNames value={names}>
      <ul className="flex flex-col gap-4">
        {pinned.map((message) => (
          <li key={message.id}>
            <MessageExcerpt
              message={message}
              author={authors.get(message.authorId) ?? FORMER_MEMBER}
            >
              {canUnpin && (
                <Button
                  variant="link"
                  size="xs"
                  className="px-0"
                  onClick={() => togglePin(message)}
                >
                  Unpin
                </Button>
              )}
            </MessageExcerpt>
          </li>
        ))}
      </ul>
    </MentionNames>
  );
}
