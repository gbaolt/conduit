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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LexicalEditor } from 'lexical';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { messagePath } from '@/features/messages/lib/message-link';
import { useCopy } from '@/hooks/use-copy';
import {
  canvasEmbeddedMessageQuery,
  canvasQuery,
} from '@/services/canvases/queries';

import { useCanvasFullWidth } from '../hooks/use-canvas-full-width';
import {
  $selectNewFirstLine,
  canvasExportMarkdownOf,
} from '../lib/canvas-extension';
import { downloadMarkdownFile } from '../lib/canvas-markdown-export';
import { CanvasActionMenu } from './canvas-action-menu';
import type { CanvasSaveStatus } from './canvas-editor';
import { CanvasCover, CanvasHeading } from './canvas-heading';
import {
  CanvasLayout,
  CanvasLayoutAside,
  CanvasLayoutContent,
} from './canvas-layout';
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

/** A canvas with its action menu, its cover and heading, its document, and its share dialog. */
export function CanvasView({
  canvas,
  onDeleted,
}: {
  canvas: CanvasDocument;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<CanvasSaveStatus>('saved');
  const [fullWidth, setFullWidth] = useCanvasFullWidth();
  const [sharing, setSharing] = useState(false);
  // Comments and History share the side card, so opening one closes the other.
  const [panel, setPanel] = useState<'comments' | 'history' | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const panelSetter = (name: 'comments' | 'history') => (open: boolean) =>
    setPanel((current) => {
      if (open) return name;
      return current === name ? null : current;
    });
  const [presenceSlot, setPresenceSlot] = useState<HTMLDivElement | null>(null);
  const [tocSlot, setTocSlot] = useState<HTMLDivElement | null>(null);
  const [compactTocSlot, setCompactTocSlot] = useState<HTMLDivElement | null>(
    null
  );
  const [insertBarSlot, setInsertBarSlot] = useState<HTMLDivElement | null>(
    null
  );
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<LexicalEditor | null>(null);
  const [exportState, setExportState] = useState<{
    editor: LexicalEditor | null;
    disabled: boolean;
  }>({ editor: null, disabled: false });
  const { copy: copyMarkdownToClipboard } = useCopy({
    onCopySuccess: () => toast.success('Copied as Markdown.'),
    onCopyError: () => toast.error('Couldn’t copy Markdown.'),
  });
  const writeFirstLine = () => {
    // A History preview hides the document, so there is nowhere to write.
    if (!editor?.isEditable() || !editor.getRootElement()?.checkVisibility())
      return;
    editor.update($selectNewFirstLine, { onUpdate: () => editor.focus() });
  };
  const resolveMessageUrl = (messageId: string) => {
    const data = queryClient.getQueryData(
      canvasEmbeddedMessageQuery(canvas.id, messageId).queryKey
    );
    if (data?.status !== 'ok') return null;
    const path = messagePath({
      ...data.message,
      roomId: data.message.room.id,
      kind: data.message.room.kind,
    });
    return new URL(path, window.location.origin).toString();
  };
  const currentMarkdown = () =>
    exportState.editor
      ? canvasExportMarkdownOf(exportState.editor, { resolveMessageUrl })
      : canvas.markdown;
  const copyMarkdown = () => void copyMarkdownToClipboard(currentMarkdown);
  const downloadMarkdown = () =>
    downloadMarkdownFile(canvas.title, currentMarkdown());

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <CanvasLayout fullWidth={fullWidth} className="scroll-fade">
        <div
          data-slot="canvas-cover"
          className="group/cover relative col-span-full w-full"
        >
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <div
              ref={setCompactTocSlot}
              className="empty:hidden @min-[60rem]:hidden"
            />
            <CanvasActionMenu
              canvas={canvas}
              status={status}
              presenceRef={setPresenceSlot}
              fullWidth={fullWidth}
              onFullWidthChange={setFullWidth}
              commentsOpen={panel === 'comments'}
              onCommentsOpenChange={panelSetter('comments')}
              historyOpen={panel === 'history'}
              onHistoryOpenChange={panelSetter('history')}
              onSaveVersion={() => setSavingVersion(true)}
              onShare={() => setSharing(true)}
              onCopyMarkdown={copyMarkdown}
              onDownloadMarkdown={downloadMarkdown}
              exportDisabled={exportState.disabled}
              onDeleted={onDeleted}
            />
          </div>
          <CanvasCover canvas={canvas} />
        </div>
        <CanvasLayoutAside>
          <div ref={setTocSlot} className="sticky top-0 pt-6" />
        </CanvasLayoutAside>
        <CanvasLayoutContent>
          <CanvasHeading canvas={canvas} onEnter={writeFirstLine} />
          <CanvasEditor
            key={canvas.id}
            canvas={canvas}
            fallback={<CanvasViewEditorSkeleton />}
            presenceSlot={presenceSlot}
            tocSlot={tocSlot}
            compactTocSlot={compactTocSlot}
            insertBarSlot={insertBarSlot}
            commentsOpen={panel === 'comments'}
            onCommentsOpenChange={panelSetter('comments')}
            historyOpen={panel === 'history'}
            onHistoryOpenChange={panelSetter('history')}
            savingVersion={savingVersion}
            onSavingVersionChange={setSavingVersion}
            onStatusChange={setStatus}
            onEditorChange={setEditor}
            onExportChange={setExportState}
          />
        </CanvasLayoutContent>
      </CanvasLayout>
      <div
        ref={setInsertBarSlot}
        className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4"
      />
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
      <CanvasLayout>
        <CanvasLayoutContent>
          <CanvasViewEditorSkeleton />
        </CanvasLayoutContent>
      </CanvasLayout>
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

/** A standalone or channel canvas opened by its id, as `/canvases/[canvasId]` and a channel's canvas tab do. */
export function CanvasViewById({
  canvasId,
  onDeleted,
}: {
  canvasId: string;
  /** Where to go once it is deleted. All canvases, unless the caller says otherwise. */
  onDeleted?: () => void;
}) {
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
      onDeleted={onDeleted ?? (() => router.push('/canvases'))}
    />
  );
}
