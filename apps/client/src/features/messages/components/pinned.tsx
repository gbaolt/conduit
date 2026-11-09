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

import { useTogglePin } from '@/services/messages/hooks';
import { pinnedQuery } from '@/services/messages/queries';
import { roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { MentionNames } from '../context/mention-names';
import { useAuthors } from '../lib/use-authors';
import { MessageExcerpt } from './message/message-excerpt';

/** The channel header's Pinned count, which opens the list. It renders nothing while no message is pinned. */
export function PinnedButton({ roomId }: { roomId: string }) {
  const { data: pinned } = useQuery(pinnedQuery(roomId));
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
          <PinnedList roomId={roomId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PinnedList({ roomId }: { roomId: string }) {
  const { data: pinned = [] } = useQuery(pinnedQuery(roomId));
  const { data: channel } = useQuery(roomQuery(roomId));
  const workspaceRole = useWorkspaceRole();
  const { authorOf, names } = useAuthors();
  const togglePin = useTogglePin(roomId);
  const canUnpin = channel ? canChannel('post', workspaceRole, channel) : false;

  return (
    <MentionNames value={names}>
      <ul className="flex flex-col gap-4">
        {pinned.map((message) => (
          <li key={message.id}>
            <MessageExcerpt
              message={message}
              author={authorOf(message.authorId)}
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
