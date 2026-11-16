'use client';

import type { SavedMessage } from '@conduit/contract';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@conduit/ui/components/dropdown-menu';
import {
  IconBookmarkFilled,
  IconBookmarkOff,
  IconHome,
  IconLayoutSidebarRight,
  IconMessage,
  IconMessageDots,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';

import {
  MessageActionButton,
  MessageActionsBar,
  MessageActionsMoreTrigger,
} from '@/features/messages/components/message/message-actions';
import { useSavedMessage } from '@/services/messages/hooks';

import { savedSplitParams } from './saved-room-panel';

/** A saved row's toolbar: Remove from saved, and a menu that opens the message where it was sent or beside the list. */
export function SavedMessageActions({ item }: { item: SavedMessage }) {
  const { message, channelName } = item;
  const { saved, toggle } = useSavedMessage(message.id);
  const [, setSplit] = useQueryStates(savedSplitParams);
  const isDm = channelName === null;

  return (
    <MessageActionsBar>
      <MessageActionButton
        label="Remove from saved"
        disabled={!saved}
        onClick={toggle}
      >
        <IconBookmarkFilled />
      </MessageActionButton>
      <DropdownMenu>
        <MessageActionsMoreTrigger />
        <DropdownMenuContent align="end" className="w-48">
          {message.parentId ? (
            // A thread already opens beside the list, so it is its own split view.
            <DropdownMenuItem
              onClick={() =>
                void setSplit({
                  thread: message.parentId,
                  room: null,
                  message: message.id,
                })
              }
            >
              <IconMessageDots />
              Open in thread
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                render={
                  <Link
                    href={`${isDm ? '/dms' : '/channels'}/${message.roomId}?message=${message.id}`}
                  />
                }
              >
                {isDm ? <IconMessage /> : <IconHome />}
                {isDm ? 'Open in DMs' : 'Open in Home'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void setSplit({
                    room: message.roomId,
                    thread: null,
                    message: message.id,
                  })
                }
              >
                <IconLayoutSidebarRight />
                Open in split view
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!saved}
            onClick={toggle}
          >
            <IconBookmarkOff />
            Remove from saved
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </MessageActionsBar>
  );
}
