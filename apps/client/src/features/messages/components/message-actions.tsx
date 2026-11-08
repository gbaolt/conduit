'use client';

import type { Message } from '@conduit/contract';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@conduit/ui/components/alert-dialog';
import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconDots,
  IconMessageDots,
  IconMoodPlus,
  IconPencil,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from '@tabler/icons-react';
import { type ReactNode, use, useState } from 'react';

import { StatusButton } from '@/components/async/status-button';
import {
  useDeleteMessage,
  useSavedMessage,
  useTogglePin,
  useToggleReaction,
} from '@/services/messages/hooks';

import { OpenThread } from '../context/thread';
import { EmojiPickerButton } from './emoji-picker';

function ActionButton({
  label,
  disabled,
  pressed,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            className="pointer-coarse:size-11"
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The floating toolbar at a row's top right: React, Reply in thread, Save for later, and the more menu. */
export function MessageActions({
  message,
  canPost,
  canEdit,
  canDelete,
  canReplyInThread,
  onEdit,
}: {
  message: Pick<Message, 'id' | 'channelId' | 'reactions' | 'pinnedAt'>;
  /** Reacting and pinning need the right to post in the channel. */
  canPost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Only a top-level message starts a thread, and not from inside its own panel. */
  canReplyInThread: boolean;
  onEdit: () => void;
}) {
  const openThread = use(OpenThread);
  const [confirming, setConfirming] = useState(false);
  const deleteMessage = useDeleteMessage(message.channelId);
  const toggleReaction = useToggleReaction(message.channelId);
  const togglePin = useTogglePin(message.channelId);
  const { saved, toggle: toggleSaved } = useSavedMessage(message.id);
  const pinned = Boolean(message.pinnedAt);

  return (
    <div className="bg-background border-border absolute top-0 right-2 flex -translate-y-1/2 rounded-md border p-px opacity-0 shadow-sm transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-aria-expanded:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100">
      {canPost && (
        <EmojiPickerButton
          label="Add reaction"
          variant="ghost"
          size="icon-xs"
          className="pointer-coarse:size-11"
          onPick={(emoji) => toggleReaction(message, emoji)}
        >
          <IconMoodPlus />
        </EmojiPickerButton>
      )}
      {canReplyInThread && openThread && (
        <ActionButton
          label="Reply in thread"
          onClick={() => openThread(message.id)}
        >
          <IconMessageDots />
        </ActionButton>
      )}
      <ActionButton
        label={saved ? 'Remove from saved' : 'Save for later'}
        pressed={saved}
        onClick={toggleSaved}
      >
        {saved ? <IconBookmarkFilled /> : <IconBookmark />}
      </ActionButton>
      {(canPost || canEdit || canDelete) && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="More actions"
                      className="pointer-coarse:size-11"
                    />
                  }
                />
              }
            >
              <IconDots />
            </TooltipTrigger>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-40">
            {canPost && (
              <DropdownMenuItem onClick={() => togglePin(message)}>
                {pinned ? <IconPinnedOff /> : <IconPin />}
                {pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
            )}
            {canEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <IconPencil />
                Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirming(true)}
              >
                <IconTrash />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears for everyone in the conversation. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <StatusButton
              variant="destructive"
              status={deleteMessage.isPending ? 'loading' : 'idle'}
              onClick={() =>
                deleteMessage.mutate(
                  { messageId: message.id },
                  { onSuccess: () => setConfirming(false) }
                )
              }
            >
              Delete message
            </StatusButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
