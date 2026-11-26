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
import { ORPCError } from '@orpc/client';
import { IconAlertTriangle, IconLayoutBoard } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LexicalEditor } from 'lexical';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { messagePath } from '@/features/messages/lib/message-link';
import { useCopy } from '@/hooks/use-copy';
import {
  canvasEmbeddedMessageQuery,
  canvasLiveblocksAuthQuery,
  canvasQuery,
} from '@/services/canvases/queries';

import { useCanvasFullWidth } from '../hooks/use-canvas-full-width';
import { useOpenedOnce } from '../hooks/use-opened-once';
import { downloadMarkdownFile } from '../lib/canvas-markdown-export';
import { CanvasActionMenu } from './canvas-action-menu';
import type { CanvasLiveblocksAuthState } from './canvas-collab-provider';
import type { CanvasSaveStatus } from './canvas-editor';
import { CanvasCover, CanvasHeading } from './canvas-heading';
import {
  CanvasLayout,
  CanvasLayoutAside,
  CanvasLayoutContent,
} from './canvas-layout';
import {
  CanvasViewEditorSkeleton,
  CanvasViewSkeleton,
} from './canvas-view-skeleton';

// Loaded only when a canvas opens, so a channel's first load does not carry the editor's plugins.
const CanvasEditor = dynamic(
  () => import('./canvas-editor').then((module) => module.CanvasEditor),
  { ssr: false, loading: () => <CanvasViewEditorSkeleton /> }
);
const CanvasShareDialog = dynamic(
  () =>
    import('./canvas-share-dialog').then((module) => module.CanvasShareDialog),
  { ssr: false }
);

/** A canvas with its action menu, its cover and heading, its document, and its share dialog. */
export function CanvasView({
  canvas,
  auth,
  active = true,
  onDeleted,
}: {
  canvas: CanvasDocument;
  auth: CanvasLiveblocksAuthState;
  active?: boolean;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<CanvasSaveStatus>('saved');
  const [fullWidth, setFullWidth] = useCanvasFullWidth();
  const [sharing, setSharing] = useState(false);
  const shareOpened = useOpenedOnce(sharing);
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
    void import('../lib/canvas-extension')
      .then(({ $selectNewFirstLine }) => {
        if (!editor.isEditable() || !editor.getRootElement()?.checkVisibility())
          return;
        editor.update($selectNewFirstLine, { onUpdate: () => editor.focus() });
      })
      .catch(() => toast.error('Couldn’t move to the canvas body.'));
  };
  const resolveMessageUrls = async (ids: string[]) => {
    const urls = new Map<string, string>();
    await Promise.all(
      ids.map(async (messageId) => {
        try {
          const data = await queryClient.ensureQueryData(
            canvasEmbeddedMessageQuery(canvas.id, messageId)
          );
          if (data.status !== 'ok') return;
          const path = messagePath({
            ...data.message,
            roomId: data.message.room.id,
            kind: data.message.room.kind,
          });
          urls.set(messageId, new URL(path, window.location.origin).toString());
        } catch {
          // Unavailable or errored embeds fall back to plain text.
        }
      })
    );
    return urls;
  };
  const currentMarkdown = async () => {
    const target = exportState.editor;
    if (!target) return canvas.markdown;
    const { canvasEmbeddedMessageIdsOf, canvasExportMarkdownOf } =
      await import('../lib/canvas-extension');
    const urls = await resolveMessageUrls(canvasEmbeddedMessageIdsOf(target));
    return canvasExportMarkdownOf(target, {
      resolveMessageUrl: (id) => urls.get(id) ?? null,
    });
  };
  const copyMarkdown = () => void copyMarkdownToClipboard(currentMarkdown);
  const downloadMarkdown = () => {
    void currentMarkdown()
      .then((markdown) => downloadMarkdownFile(canvas.title, markdown))
      .catch(() => toast.error('Couldn’t download Markdown.'));
  };

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
            auth={auth}
            active={active}
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
      {!canvas.roomId && shareOpened && (
        <CanvasShareDialog
          canvas={canvas}
          open={sharing}
          onOpenChange={setSharing}
        />
      )}
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
  expectedRoomId,
  active = true,
  onDeleted,
}: {
  canvasId: string;
  /** When opened inside a room tab, reject canvases belonging to another room. */
  expectedRoomId?: string;
  active?: boolean;
  /** Where to go once it is deleted. All canvases, unless the caller says otherwise. */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activationId, setActivationId] = useState(() => crypto.randomUUID());
  const openingId = `${canvasId}:${activationId}`;
  const canvas = useQuery(canvasQuery(canvasId));
  const auth = useQuery(canvasLiveblocksAuthQuery(canvasId, openingId));

  useEffect(() => {
    // Warm the editor chunk alongside the canvas and auth fetches so it does not wait on them.
    void import('./canvas-editor').catch(() => {});
  }, [canvasId]);

  useEffect(() => {
    return () => {
      // Cache Components hides routes via <Activity> without unmounting; rotate on deactivation so reveal fetches fresh.
      setActivationId(crypto.randomUUID());
    };
  }, []);

  useEffect(() => {
    const { queryKey } = canvasLiveblocksAuthQuery(canvasId, openingId);
    return () => {
      queryClient.removeQueries({ queryKey, exact: true });
    };
  }, [canvasId, openingId, queryClient]);

  const notFound = (
    <CanvasViewState
      title="Canvas not found"
      description="It was deleted, or it has not been shared with you."
      action={{
        label: 'All canvases',
        onClick: () => router.push('/canvases'),
      }}
    />
  );

  if (canvas.isPending) return <CanvasViewSkeleton />;
  if (canvas.isError) {
    return canvas.error instanceof ORPCError &&
      canvas.error.code === 'NOT_FOUND' ? (
      notFound
    ) : (
      <CanvasViewState
        failed
        title="Couldn't load this canvas"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void canvas.refetch() }}
      />
    );
  }
  if (expectedRoomId !== undefined && canvas.data.roomId !== expectedRoomId) {
    return notFound;
  }

  return (
    <CanvasView
      canvas={canvas.data}
      auth={auth}
      active={active}
      onDeleted={
        onDeleted ??
        (() => {
          if (window.location.pathname === `/canvases/${canvasId}`) {
            router.push('/canvases');
          }
        })
      }
    />
  );
}
