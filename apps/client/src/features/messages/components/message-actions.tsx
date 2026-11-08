'use client';

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
import { IconDots, IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import { StatusButton } from '@/components/async/status-button';
import { useDeleteMessage } from '@/services/messages/hooks';

/** The floating toolbar at a row's top right. It renders nothing when the viewer can do nothing to the message. */
export function MessageActions({
  channelId,
  messageId,
  canEdit,
  canDelete,
  onEdit,
}: {
  channelId: string;
  messageId: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const deleteMessage = useDeleteMessage(channelId);

  if (!canEdit && !canDelete) return null;

  return (
    <div className="bg-background border-border absolute top-0 right-2 -translate-y-1/2 rounded-md border opacity-0 shadow-sm transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-aria-expanded:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100">
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
                  { messageId },
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
