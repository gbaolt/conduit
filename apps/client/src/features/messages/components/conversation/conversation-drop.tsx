'use client';

import { cn } from '@conduit/ui/lib/utils';
import { IconUpload } from '@tabler/icons-react';
import { type DragEvent, useRef, useState } from 'react';

const carriesFiles = (event: DragEvent) =>
  event.dataTransfer.types.includes('Files');

/**
 * Lets files dropped anywhere on a conversation join its composer. Handlers run in the capture phase,
 * so the editor never inserts a dropped file itself. Pass no `onFiles` where the viewer cannot post.
 */
export function useFileDrop(onFiles: ((files: File[]) => void) | undefined) {
  const [dragging, setDragging] = useState(false);
  // dragenter and dragleave fire for every child crossed, so the count reaches zero only on leaving the panel.
  const depth = useRef(0);

  if (!onFiles) return { dragging: false, handlers: {} };

  return {
    dragging,
    handlers: {
      onDragEnterCapture: (event: DragEvent) => {
        if (!carriesFiles(event)) return;
        depth.current += 1;
        setDragging(true);
      },
      onDragOverCapture: (event: DragEvent) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeaveCapture: (event: DragEvent) => {
        if (!carriesFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDropCapture: (event: DragEvent) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current = 0;
        setDragging(false);
        onFiles([...event.dataTransfer.files]);
      },
    },
  };
}

/** Covers the conversation while files are dragged over it, naming where they will go. */
export function ConversationDropOverlay({
  dragging,
  title,
}: {
  dragging: boolean;
  title: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-background/85 border-primary/50 pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-lg border-2 border-dashed transition-opacity duration-150 ease-out motion-reduce:transition-none',
        dragging ? 'opacity-100' : 'opacity-0'
      )}
    >
      <p className="text-foreground flex items-center gap-2 text-sm font-medium">
        <IconUpload className="size-4" />
        Drop to share in {title}
      </p>
    </div>
  );
}
