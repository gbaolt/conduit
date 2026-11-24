'use client';

import { CANVAS_TITLE_MAX, type CanvasDocument } from '@conduit/contract';
import {
  AlertDialog,
  AlertDialogAction,
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
import { Input } from '@conduit/ui/components/input';
import { IconDots, IconTrash, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useDeleteCanvas, useUpdateCanvas } from '@/services/canvases/hooks';

import type { CanvasSaveStatus } from './canvas-editor';

const STATUS_LABELS: Record<CanvasSaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  failed: 'Couldn’t save',
};

/** The title, renamed in place by anyone who can edit. It saves on Enter or when focus leaves. */
function CanvasHeaderTitle({ canvas }: { canvas: CanvasDocument }) {
  const update = useUpdateCanvas();
  const [title, setTitle] = useState(canvas.title);

  if (!canvas.access.edit) {
    return (
      <h1 className="min-w-0 truncate px-2 text-base font-semibold">
        {canvas.title}
      </h1>
    );
  }

  const commit = () => {
    const next = title.trim();
    if (!next || next === canvas.title) {
      setTitle(canvas.title);
      return;
    }
    update.mutate(
      { canvasId: canvas.id, title: next },
      {
        onError: (error) => {
          setTitle(canvas.title);
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <Input
      aria-label="Canvas title"
      value={title}
      maxLength={CANVAS_TITLE_MAX}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setTitle(canvas.title);
          event.currentTarget.blur();
        }
      }}
      className="hover:border-input h-8 min-w-0 flex-1 border-transparent bg-transparent text-base font-semibold shadow-none dark:bg-transparent"
    />
  );
}

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

function CanvasHeaderMenu({
  canvas,
  onDeleted,
}: {
  canvas: CanvasDocument;
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
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirming(true)}
          >
            <IconTrash />
            Delete canvas
          </DropdownMenuItem>
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
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The canvas's title row: its name, save status, who else is on it, sharing for a standalone canvas, and its
 * actions. The live editor renders the avatars into `presenceRef`, since only it is inside the live room.
 */
export function CanvasHeader({
  canvas,
  status,
  presenceRef,
  onShare,
  onDeleted,
}: {
  canvas: CanvasDocument;
  status: CanvasSaveStatus;
  presenceRef: (element: HTMLDivElement | null) => void;
  onShare: () => void;
  onDeleted: () => void;
}) {
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-2 px-2 sm:px-4">
      <CanvasHeaderTitle key={canvas.title} canvas={canvas} />
      <CanvasHeaderStatus canvas={canvas} status={status} />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div ref={presenceRef} className="flex empty:hidden" />
        {!canvas.roomId && (
          <Button variant="outline" size="sm" onClick={onShare}>
            <IconUsers data-icon="inline-start" />
            Share
          </Button>
        )}
        {canvas.access.delete && (
          <CanvasHeaderMenu canvas={canvas} onDeleted={onDeleted} />
        )}
      </div>
    </div>
  );
}
