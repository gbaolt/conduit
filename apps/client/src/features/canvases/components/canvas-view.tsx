'use client';

import type { CanvasDocument } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { ORPCError } from '@orpc/client';
import { IconAlertTriangle, IconLayoutBoard } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { StatusButton } from '@/components/async/status-button';
import { canvasQuery } from '@/services/canvases/queries';

import type { CanvasSaveStatus } from './canvas-editor';
import { CanvasHeader } from './canvas-header';
import { CanvasShareDialog } from './canvas-share-dialog';

const LINE_WIDTHS = ['w-2/3', 'w-full', 'w-5/6', 'w-1/2'];

/** Lines where the document will be, while the editor's code loads. */
export function CanvasViewEditorSkeleton() {
  return (
    <div role="status" aria-label="Loading canvas" className="space-y-4 pl-8">
      {LINE_WIDTHS.map((width) => (
        <Skeleton key={width} className={`h-4 ${width}`} />
      ))}
    </div>
  );
}

// Loaded only when a canvas opens, so a channel's first load does not carry the editor's plugins.
const CanvasEditor = dynamic(
  () => import('./canvas-editor').then((module) => module.CanvasEditor),
  { ssr: false, loading: () => <CanvasViewEditorSkeleton /> }
);

/** A canvas with its title row, its document, and its share dialog. */
export function CanvasView({
  canvas,
  onDeleted,
}: {
  canvas: CanvasDocument;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<CanvasSaveStatus>('saved');
  const [sharing, setSharing] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CanvasHeader
        canvas={canvas}
        status={status}
        onShare={() => setSharing(true)}
        onDeleted={onDeleted}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-2 py-6 sm:px-6">
          <CanvasEditor
            key={canvas.id}
            canvas={canvas}
            onStatusChange={setStatus}
          />
        </div>
      </div>
      {!canvas.roomId && (
        <CanvasShareDialog
          canvas={canvas}
          open={sharing}
          onOpenChange={setSharing}
        />
      )}
    </div>
  );
}

export function CanvasViewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 items-center px-4">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="mx-auto w-full max-w-3xl px-2 py-6 sm:px-6">
        <CanvasViewEditorSkeleton />
      </div>
    </div>
  );
}

export function CanvasViewState({
  title,
  description,
  failed = false,
  action,
}: {
  title: string;
  description: string;
  failed?: boolean;
  action?: {
    label: string;
    onClick: () => void;
    primary?: boolean;
    pending?: boolean;
  };
}) {
  const Icon = failed ? IconAlertTriangle : IconLayoutBoard;

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          {action.pending !== undefined ? (
            <StatusButton
              size="sm"
              variant={action.primary ? 'default' : 'outline'}
              status={action.pending ? 'loading' : 'idle'}
              onClick={action.onClick}
            >
              {action.label}
            </StatusButton>
          ) : (
            <Button
              size="sm"
              variant={action.primary ? 'default' : 'outline'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </EmptyContent>
      )}
    </Empty>
  );
}

/** A standalone or channel canvas opened by its id, as `/canvases/[canvasId]` does. */
export function CanvasViewById({ canvasId }: { canvasId: string }) {
  const router = useRouter();
  const canvas = useQuery(canvasQuery(canvasId));

  if (canvas.isPending) return <CanvasViewSkeleton />;
  if (canvas.isError) {
    return canvas.error instanceof ORPCError &&
      canvas.error.code === 'NOT_FOUND' ? (
      <CanvasViewState
        title="Canvas not found"
        description="It was deleted, or it has not been shared with you."
        action={{
          label: 'All canvases',
          onClick: () => router.push('/canvases'),
        }}
      />
    ) : (
      <CanvasViewState
        failed
        title="Couldn't load this canvas"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void canvas.refetch() }}
      />
    );
  }

  return (
    <CanvasView
      canvas={canvas.data}
      onDeleted={() => router.push('/canvases')}
    />
  );
}
