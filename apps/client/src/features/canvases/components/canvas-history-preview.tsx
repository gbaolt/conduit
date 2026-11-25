'use client';

import type { CanvasVersion } from '@conduit/contract';
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
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import { IconArrowBackUp, IconX } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { defineExtension, type LexicalEditor } from 'lexical';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { MessageEmbedRenderer } from '@/components/editor/nodes/message-embed-node';
import { CalloutPlugin } from '@/components/editor/plugins/callout-plugin';
import { useRestoreCanvasVersion } from '@/services/canvases/hooks';
import { canvasVersionQuery } from '@/services/canvases/queries';

import {
  $replaceCanvasContent,
  canvasMarkdownOf,
  createCanvasExtension,
} from '../lib/canvas-extension';
import { CanvasMessageEmbed } from './canvas-message-embed';
import { CANVAS_DIALOG_MOTION } from './canvas-save-version-dialog';

const savedFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** A version, read-only, in its own editor: it never joins the live room, so nobody else sees it. */
function CanvasHistoryPreviewDocument({ version }: { version: CanvasVersion }) {
  const extension = useMemo(
    () =>
      defineExtension({
        name: '@conduit/canvas-preview',
        editable: false,
        dependencies: [createCanvasExtension(version)],
      }),
    [version]
  );
  const renderEmbed = useCallback(
    (messageId: string) => (
      <CanvasMessageEmbed canvasId={version.canvasId} messageId={messageId} />
    ),
    [version.canvasId]
  );

  // The renderer wraps the composer, so embed cards rendered through Lexical's decorator portals can read it.
  return (
    <MessageEmbedRenderer value={renderEmbed}>
      <LexicalExtensionComposer extension={extension} contentEditable={null}>
        <ContentEditable
          aria-label={`Version from ${savedFormat.format(version.createdAt)}`}
          aria-readonly
          className="min-h-[50dvh] pb-24 pl-8 leading-7 outline-none"
        />
        <CalloutPlugin />
      </LexicalExtensionComposer>
    </MessageEmbedRenderer>
  );
}

function CanvasHistoryPreviewRestore({
  version,
  editor,
  onRestored,
}: {
  version: CanvasVersion;
  editor: LexicalEditor;
  onRestored: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const restore = useRestoreCanvasVersion();

  const confirm = () =>
    restore.mutate(
      {
        canvasId: version.canvasId,
        versionId: version.id,
        currentSnapshotJson: editor
          .getEditorState()
          .toJSON() as unknown as Record<string, unknown>,
        currentMarkdown: canvasMarkdownOf(editor),
      },
      {
        onSuccess: ({ canvas }) => {
          // One ordinary edit, so the live document sends it to everyone with the canvas open.
          editor.update(() =>
            $replaceCanvasContent(canvas.snapshotJson ?? version.snapshotJson)
          );
          setConfirming(false);
          toast.success('Version restored.');
          onRestored();
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <>
      <Button size="sm" onClick={() => setConfirming(true)}>
        <IconArrowBackUp data-icon="inline-start" />
        Restore this version
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent
          className={CANVAS_DIALOG_MOTION}
          // Escape closes only the dialog, not the preview behind it.
          onKeyDown={(event) => event.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone with the canvas open sees it change. What&apos;s there
              now is kept in History first, so you can restore it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <StatusButton
              status={restore.isPending ? 'loading' : 'idle'}
              onClick={confirm}
            >
              Restore
            </StatusButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * A saved version shown in place of the live canvas, with a bar to restore it or go back. Switching versions
 * keeps the last one on screen until the next arrives, so stepping through them never flashes a loader.
 */
export function CanvasHistoryPreview({
  canvasId,
  versionId,
  editor,
  canRestore,
  fallback,
  onExit,
  onRestored,
}: {
  canvasId: string;
  versionId: string;
  /** The live editor, which a restore replaces the content of. */
  editor: LexicalEditor;
  canRestore: boolean;
  fallback: ReactNode;
  onExit: () => void;
  onRestored: () => void;
}) {
  const version = useQuery({
    ...canvasVersionQuery(canvasId, versionId),
    placeholderData: keepPreviousData,
  });

  return (
    <section
      aria-label="Version preview"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onExit();
      }}
    >
      <div className="mb-4 flex min-h-9 items-center gap-2 border-b pb-3 pl-8">
        <p className="min-w-0 flex-1 truncate text-sm">
          {version.data ? (
            <>
              <span className="font-medium">
                {version.data.label ?? 'Version'}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {' · '}
                {savedFormat.format(version.data.createdAt)}
              </span>
            </>
          ) : (
            'Loading version…'
          )}
        </p>
        {canRestore && version.data && (
          <CanvasHistoryPreviewRestore
            version={version.data}
            editor={editor}
            onRestored={onRestored}
          />
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close preview"
          onClick={onExit}
        >
          <IconX />
        </Button>
      </div>
      {version.isError && (
        <p className="text-muted-foreground pl-8 text-sm">
          Couldn&apos;t load this version.{' '}
          <Button
            variant="link"
            size="xs"
            onClick={() => void version.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
      {!version.isError &&
        (version.data ? (
          <CanvasHistoryPreviewDocument
            key={version.data.id}
            version={version.data}
          />
        ) : (
          fallback
        ))}
    </section>
  );
}
