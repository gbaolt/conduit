'use client';

import { type Message, plainText } from '@conduit/contract';
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
import { Twemoji } from '@conduit/ui/components/twemoji';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconCopy,
  IconDots,
  IconMessageDots,
  IconMoodPlus,
  IconPencil,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from '@tabler/icons-react';
import { type ReactNode, use, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import {
  useDeleteMessage,
  useSavedMessage,
  useTogglePin,
  useToggleReaction,
} from '@/services/messages/hooks';

import { MentionNames } from '../../context/mention-names';
import { OpenThread } from '../../context/thread';
import { useQuickReactions } from '../../hooks/use-quick-reactions';
import { ReactionPickerButton } from './reaction-picker';

/** One icon button in the toolbar, with its label as the tooltip. */
export function MessageActionButton({
  label,
  disabled,
  pressed,
  className,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
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
            className={cn('group/button pointer-coarse:size-9', className)}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <Twemoji key={label}>{label}</Twemoji>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The floating bar at a row's top right. It shows while the row is hovered with a mouse, holds keyboard focus, is held on a touch screen, or has a menu open. It ignores taps while hidden.
 * It straddles the row's top edge, except under a divider, where it drops inside the row so the day or New label stays readable.
 */
export function MessageActionsBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background border-border pointer-events-none absolute top-0 right-2 flex -translate-y-1/2 rounded-md border p-px opacity-0 shadow-sm transition-opacity group-focus-visible/message:pointer-events-auto group-focus-visible/message:opacity-100 group-has-focus-visible/message:pointer-events-auto group-has-focus-visible/message:opacity-100 group-data-held/message:pointer-events-auto group-data-held/message:opacity-100 in-[[role=separator]+[role=article]]:translate-y-0.5 has-aria-expanded:pointer-events-auto has-aria-expanded:opacity-100 motion-reduce:transition-none pointer-fine:group-hover/message:pointer-events-auto pointer-fine:group-hover/message:opacity-100">
      {children}
    </div>
  );
}

/** The more menu's trigger, with its tooltip. */
export function MessageActionsMoreTrigger() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="More actions"
                className="pointer-coarse:size-9"
              />
            }
          />
        }
      >
        <IconDots />
      </TooltipTrigger>
      <TooltipContent>More actions</TooltipContent>
    </Tooltip>
  );
}

/** The floating toolbar at a row's top right: the quick reactions, React, Reply in thread, Save for later, and the more menu with Copy text. */
export function MessageActions({
  message,
  viewerId,
  canPost,
  canEdit,
  canDelete,
  canReplyInThread,
  onEdit,
}: {
  message: Pick<Message, 'id' | 'roomId' | 'body' | 'reactions' | 'pinnedAt'>;
  viewerId: string | null;
  /** Reacting and pinning need the right to post in the channel. */
  canPost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Only a top-level message starts a thread, and not from inside its own panel. */
  canReplyInThread: boolean;
  onEdit: () => void;
}) {
  const openThread = use(OpenThread);
  const names = use(MentionNames);
  const [confirming, setConfirming] = useState(false);
  const deleteMessage = useDeleteMessage(message.roomId);
  const toggleReaction = useToggleReaction(message.roomId);
  const togglePin = useTogglePin(message.roomId);
  const { saved, toggle: toggleSaved } = useSavedMessage(message.id);
  const { reactions: quickReactions } = useQuickReactions();
  const pinned = Boolean(message.pinnedAt);

  return (
    <MessageActionsBar>
      {canPost && (
        <>
          {quickReactions.map((emoji) => {
            const reacted =
              viewerId !== null &&
              Boolean(message.reactions[emoji]?.includes(viewerId));
            return (
              <MessageActionButton
                key={emoji}
                label={reacted ? `Remove ${emoji}` : `React with ${emoji}`}
                pressed={reacted}
                className="aria-pressed:bg-primary/15 aria-pressed:hover:bg-primary/25"
                onClick={() => toggleReaction(message, emoji)}
              >
                <Twemoji className="button-magnify m-0 size-4 align-middle">
                  {emoji}
                </Twemoji>
              </MessageActionButton>
            );
          })}
          <ReactionPickerButton
            label="Add reaction"
            variant="ghost"
            size="icon-xs"
            className="group/button pointer-coarse:size-9"
            onPick={(emoji) => toggleReaction(message, emoji)}
          >
            <IconMoodPlus className="button-magnify" />
          </ReactionPickerButton>
        </>
      )}
      {canReplyInThread && openThread && (
        <MessageActionButton
          label="Reply in thread"
          onClick={() => openThread(message.id)}
        >
          <IconMessageDots className="button-magnify" />
        </MessageActionButton>
      )}
      <MessageActionButton
        label={saved ? 'Remove from saved' : 'Save for later'}
        pressed={saved}
        onClick={toggleSaved}
      >
        {saved ? (
          <IconBookmarkFilled className="button-magnify" />
        ) : (
          <IconBookmark className="button-magnify" />
        )}
      </MessageActionButton>
      <DropdownMenu>
        <MessageActionsMoreTrigger />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() =>
              navigator.clipboard
                .writeText(plainText(message.body, Object.fromEntries(names)))
                .then(
                  () => toast.success('Message copied'),
                  () => toast.error('Could not copy the message')
                )
            }
          >
            <IconCopy data-slot="icon" />
            Copy text
          </DropdownMenuItem>
          {canPost && (
            <DropdownMenuItem onClick={() => togglePin(message)}>
              {pinned ? (
                <IconPinnedOff data-slot="icon" />
              ) : (
                <IconPin data-slot="icon" />
              )}
              {pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <IconPencil data-slot="icon" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              <IconTrash data-slot="icon" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
    </MessageActionsBar>
  );
}
