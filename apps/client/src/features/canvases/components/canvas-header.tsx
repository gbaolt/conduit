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
  DropdownMenuContent,
  DropdownMenuItem,
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

/** "Saved", "Saving…", or "Read only" for someone who cannot edit. Read out when it changes. */
function CanvasHeaderStatus({
  canvas,
  status,
}: {
  canvas: CanvasDocument;
  status: CanvasSaveStatus;
}) {
  return (
    <span
      aria-live="polite"
      className="text-muted-foreground shrink-0 text-xs whitespace-nowrap"
    >
      {canvas.access.edit ? STATUS_LABELS[status] : 'Read only'}
    </span>
  );
}

/** Opens the comments panel. Its badge counts the threads still open. */
function CanvasHeaderComments({
  canvasId,
  open,
  onOpenChange,
}: {
  canvasId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: threads } = useQuery(canvasCommentsQuery(canvasId));
  const count = threads?.filter((thread) => !thread.resolvedAt).length ?? 0;

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={open}
      aria-label={count > 0 ? `Comments, ${count} open` : 'Comments'}
      onClick={() => onOpenChange(!open)}
      className="aria-pressed:bg-muted"
    >
      <IconMessage2 data-icon="inline-start" />
      <span className="max-sm:sr-only">Comments</span>
      {count > 0 && <Badge variant="secondary">{count}</Badge>}
    </Button>
  );
}

/** Opens the version list beside the canvas. */
function CanvasHeaderHistory({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={open}
      onClick={() => onOpenChange(!open)}
      className="aria-pressed:bg-muted"
    >
      <IconHistory data-icon="inline-start" />
      <span className="max-sm:sr-only">History</span>
    </Button>
  );
}

function CanvasHeaderMenu({
  canvas,
  onSaveVersion,
  onDeleted,
}: {
  canvas: CanvasDocument;
  onSaveVersion: () => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteCanvas();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Canvas actions"
            />
          }
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canvas.access.edit && (
            <DropdownMenuItem onClick={onSaveVersion}>
              <IconDeviceFloppy />
              Save version
            </DropdownMenuItem>
          )}
          {canvas.access.delete && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              <IconTrash />
              Delete canvas
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
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
                      setConfirming(false);
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
    </>
  );
}

/**
 * The canvas's toolbar: save status, who else is on it, sharing for a standalone canvas, and its actions. The
 * title lives in the document's heading. The live editor renders the avatars into `presenceRef`, since only it is
 * inside the live room.
 */
export function CanvasHeader({
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
  return (
    <div className="flex min-h-10 shrink-0 items-center justify-end gap-2 px-2 sm:px-4">
      <CanvasHeaderStatus canvas={canvas} status={status} />
      <div className="flex shrink-0 items-center gap-1">
        <div ref={presenceRef} className="flex empty:hidden" />
        <CanvasHeaderComments
          canvasId={canvas.id}
          open={commentsOpen}
          onOpenChange={onCommentsOpenChange}
        />
        <CanvasHeaderHistory
          open={historyOpen}
          onOpenChange={onHistoryOpenChange}
        />
        {!canvas.roomId && (
          <Button variant="outline" size="sm" onClick={onShare}>
            <IconUsers data-icon="inline-start" />
            Share
          </Button>
        )}
        {(canvas.access.edit || canvas.access.delete) && (
          <CanvasHeaderMenu
            canvas={canvas}
            onSaveVersion={onSaveVersion}
            onDeleted={onDeleted}
          />
        )}
      </div>
    </div>
  );
}
