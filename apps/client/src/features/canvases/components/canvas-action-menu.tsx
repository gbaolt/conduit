'use client';

import type { CanvasDocument } from '@conduit/contract';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@conduit/ui/components/alert-dialog';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  IconDeviceFloppy,
  IconDots,
  IconHistory,
  IconMessage2,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useDeleteCanvas } from '@/services/canvases/hooks';
import { canvasCommentsQuery } from '@/services/canvases/queries';

import type { CanvasSaveStatus } from './canvas-editor';

const STATUS_LABELS: Record<CanvasSaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  failed: 'Couldn’t save',
};

function CanvasActionMenuDelete({
  canvas,
  open,
  onOpenChange,
  onDeleted,
}: {
  canvas: CanvasDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteCanvas();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{canvas.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Nobody will be able to open it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <StatusButton
            variant="destructive"
            status={remove.isPending ? 'loading' : 'idle'}
            onClick={() =>
              remove.mutate(
                { canvasId: canvas.id },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    onDeleted();
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            Delete
          </StatusButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Everything about the canvas that is not its document, behind one button at the canvas's top left: save status,
 * who else is on it, comments, history, sharing, versions and deletion. A failed save marks the button, since the
 * status inside stays hidden until the menu opens. The live editor renders the avatars into `presenceRef`, since
 * only it is inside the live room.
 */
export function CanvasActionMenu({
  canvas,
  status,
  presenceRef,
  commentsOpen,
  onCommentsOpenChange,
  historyOpen,
  onHistoryOpenChange,
  onSaveVersion,
  onShare,
  onDeleted,
}: {
  canvas: CanvasDocument;
  status: CanvasSaveStatus;
  presenceRef: (element: HTMLDivElement | null) => void;
  commentsOpen: boolean;
  onCommentsOpenChange: (open: boolean) => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onSaveVersion: () => void;
  onShare: () => void;
  onDeleted: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { data: threads } = useQuery(canvasCommentsQuery(canvas.id));
  const openThreads =
    threads?.filter((thread) => !thread.resolvedAt).length ?? 0;
  const failed = canvas.access.edit && status === 'failed';

  return (
    <>
      <span aria-live="polite" className="sr-only">
        {failed ? 'Couldn’t save the canvas' : ''}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                failed ? 'Canvas actions, couldn’t save' : 'Canvas actions'
              }
              className="bg-background/80 hover:bg-muted relative"
            />
          }
        >
          <IconDots />
          {failed && (
            <span className="bg-destructive absolute top-1 right-1 size-1.5 rounded-full" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup className="flex min-h-8 items-center justify-between gap-2 pr-1.5">
            <DropdownMenuLabel
              className={failed ? 'text-destructive' : undefined}
            >
              {canvas.access.edit ? STATUS_LABELS[status] : 'Read only'}
            </DropdownMenuLabel>
            <div ref={presenceRef} className="flex empty:hidden" />
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem
              checked={commentsOpen}
              onCheckedChange={onCommentsOpenChange}
              closeOnClick
            >
              <IconMessage2 />
              Comments
              {openThreads > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {openThreads}
                </Badge>
              )}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={historyOpen}
              onCheckedChange={onHistoryOpenChange}
              closeOnClick
            >
              <IconHistory />
              History
            </DropdownMenuCheckboxItem>
            {!canvas.roomId && (
              <DropdownMenuItem onClick={onShare}>
                <IconUsers />
                Share
              </DropdownMenuItem>
            )}
            {canvas.access.edit && (
              <DropdownMenuItem onClick={onSaveVersion}>
                <IconDeviceFloppy />
                Save version
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {canvas.access.delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                <IconTrash />
                Delete canvas
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canvas.access.delete && (
        <CanvasActionMenuDelete
          canvas={canvas}
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
