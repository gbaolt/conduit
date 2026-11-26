'use client';

import type { CanvasDocument } from '@conduit/contract';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
import { Button } from '@conduit/ui/components/button';
import { buildEditorFromExtensions } from '@lexical/extension';
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionEditorComposer } from '@lexical/react/LexicalExtensionEditorComposer';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { ReactProviderExtension } from '@lexical/react/ReactProviderExtension';
import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';
import { useRoom, useStatus } from '@liveblocks/react';
import { getYjsProviderForRoom } from '@liveblocks/yjs';
import { IconPlugConnectedX, IconUserPlus, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  BLUR_COMMAND,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  configExtension,
  HISTORY_MERGE_TAG,
  type LexicalEditor,
  type LexicalEditorWithDispose,
  PASTE_COMMAND,
} from 'lexical';
import dynamic from 'next/dynamic';
import {
  Component,
  type ComponentProps,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { XmlText } from 'yjs';

import { StatusButton } from '@/components/async/status-button';
import {
  $isMentionNode,
  MentionNode,
} from '@/components/editor/nodes/mention-node';
import {
  $createMessageEmbedNode,
  MessageEmbedRenderer,
} from '@/components/editor/nodes/message-embed-node';
import { CalloutPlugin } from '@/components/editor/plugins/callout-plugin';
import { CodeBlockPlugin } from '@/components/editor/plugins/code-block-plugin';
import { LayoutPlugin } from '@/components/editor/plugins/layout-plugin';
import { LazyCodeHighlightPlugin } from '@/components/editor/plugins/lazy-code-highlight-plugin';
import { TogglePlugin } from '@/components/editor/plugins/toggle-plugin';
import { sessionQuery } from '@/services/auth/queries';
import {
  useClaimCanvasBootstrap,
  useSaveCanvasSnapshot,
  useShareCanvas,
  useUpdateCanvas,
} from '@/services/canvases/hooks';
import { canvasMembersQuery } from '@/services/canvases/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import { useOpenedOnce } from '../hooks/use-opened-once';
import {
  $seedCanvasFromMarkdown,
  canvasMarkdownOf,
  createCanvasExtension,
} from '../lib/canvas-extension';
import { tryBuildCanvasPreviewEditor } from '../lib/canvas-snapshot-preview';
import { createLiveblocksYjsAdapter } from '../lib/liveblocks-yjs-adapter';
import { parseMessageUrl } from '../lib/message-url';
import {
  CanvasCollabProvider,
  type CanvasLiveblocksAuthState,
  useCanvasCollab,
} from './canvas-collab-provider';
import {
  CanvasCommentsPlugin,
  CanvasCommentsPluginLive,
  useCanvasComments,
} from './canvas-comments-plugin';
import { CanvasHistoryPanelSync } from './canvas-history-panel-sync';
import { CanvasMessageEmbed } from './canvas-message-embed';
import { CanvasPresenceAvatars } from './canvas-presence-avatars';
import { CanvasTemplatePicker } from './canvas-templates';
import {
  CanvasToc,
  CanvasTocHashScroll,
  useCanvasHeadings,
} from './canvas-toc';
import { CanvasViewEditorSkeleton } from './canvas-view-skeleton';

// Each loads the first time it is needed, so opening a canvas carries only the document.
const CanvasEditorEditPlugins = dynamic(
  () =>
    import('./canvas-editor-edit-plugins').then(
      (module) => module.CanvasEditorEditPlugins
    ),
  { ssr: false }
);
const CanvasCommentPopover = dynamic(
  () =>
    import('./canvas-comment-popover').then(
      (module) => module.CanvasCommentPopover
    ),
  { ssr: false }
);
const CanvasCommentsPanel = dynamic(
  () =>
    import('./canvas-comments-panel').then(
      (module) => module.CanvasCommentsPanel
    ),
  { ssr: false }
);
const CanvasHistoryPanel = dynamic(
  () =>
    import('./canvas-history-panel').then(
      (module) => module.CanvasHistoryPanel
    ),
  { ssr: false }
);
const CanvasHistoryPreview = dynamic(
  () =>
    import('./canvas-history-preview').then(
      (module) => module.CanvasHistoryPreview
    ),
  { ssr: false, loading: () => <CanvasViewEditorSkeleton /> }
);
const CanvasSaveVersionDialog = dynamic(
  () =>
    import('./canvas-save-version-dialog').then(
      (module) => module.CanvasSaveVersionDialog
    ),
  { ssr: false }
);

export type CanvasSaveStatus = 'saved' | 'saving' | 'failed';

const SAVE_DELAY_MS = 1000;
/** A live canvas is already safe in Liveblocks, so Postgres only needs a copy once typing settles. */
const SNAPSHOT_DELAY_MS = 30_000;
/** Browsers drop a `keepalive` request whose body passes 64 KB. */
const KEEPALIVE_MAX = 60_000;

/** `loading` until the live document first syncs, then `offline` whenever the room connection drops. */
type CanvasLiveState = 'loading' | 'ready' | 'offline';

type ProviderFactory = ComponentProps<
  typeof CollaborationPlugin
>['providerFactory'];

async function sha256(text: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    (byte + 0x100).toString(16).slice(1)
  ).join('');
}

function seedCanvas(
  editor: LexicalEditor,
  seed: { snapshotJson: string | null; initialMarkdown: string | null },
  names: ReadonlyMap<string, string>
) {
  if (seed.snapshotJson) {
    editor.setEditorState(editor.parseEditorState(seed.snapshotJson), {
      tag: HISTORY_MERGE_TAG,
    });
    return;
  }
  editor.update(
    () => {
      if (!$getRoot().isEmpty()) return;
      if (seed.initialMarkdown) {
        $seedCanvasFromMarkdown(seed.initialMarkdown, names);
      } else {
        $getRoot().append($createParagraphNode());
      }
    },
    { discrete: true, tag: HISTORY_MERGE_TAG }
  );
}

/** Saves a second after typing stops, when the editor loses focus, and when the canvas closes. */
function CanvasEditorAutosave({
  canvasId,
  onStatusChange,
}: {
  canvasId: string;
  onStatusChange: (status: CanvasSaveStatus) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const update = useUpdateCanvas();
  const dirty = useRef(false);
  const lastSavedJson = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    lastSavedJson.current = JSON.stringify(editor.getEditorState().toJSON());
  }, [editor]);

  const save = useEffectEvent(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const snapshotJson = editor.getEditorState().toJSON() as unknown as Record<
      string,
      unknown
    >;
    const serialized = JSON.stringify(snapshotJson);
    if (serialized === lastSavedJson.current) {
      onStatusChange('saved');
      return;
    }
    const markdown = canvasMarkdownOf(editor);
    onStatusChange('saving');
    // One save at a time, so an older snapshot never lands after a newer one.
    saving.current = saving.current.then(() =>
      update
        .mutateAsync({ canvasId, snapshotJson, markdown })
        .then(() => {
          lastSavedJson.current = serialized;
          if (!dirty.current) onStatusChange('saved');
        })
        .catch((error: Error) => {
          dirty.current = true;
          onStatusChange('failed');
          toast.error(error.message);
        })
    );
  });

  useEffect(() => {
    const flush = () => save();
    window.addEventListener('pagehide', flush);
    return mergeRegister(
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, tags }) => {
        if (tags.has('history-merge')) return;
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        dirty.current = true;
        onStatusChange('saving');
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DELAY_MS);
      }),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          flush();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      () => {
        window.removeEventListener('pagehide', flush);
        flush();
      }
    );
  }, [editor, onStatusChange]);

  return null;
}

/**
 * Copies a live canvas into Postgres 30 seconds after the viewer's own last edit, when the tab is hidden or
 * closed, and when the canvas closes. A copy that matches the last one is never sent.
 */
function CanvasEditorSnapshot({
  canvasId,
  onStatusChange,
}: {
  canvasId: string;
  onStatusChange: (status: CanvasSaveStatus) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const saveSnapshot = useSaveCanvasSnapshot();
  const dirty = useRef(false);
  const lastHash = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  const save = useEffectEvent(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const snapshotJson = editor.getEditorState().toJSON() as unknown as Record<
      string,
      unknown
    >;
    const serialized = JSON.stringify(snapshotJson);
    const markdown = canvasMarkdownOf(editor);
    const keepalive = serialized.length + markdown.length < KEEPALIVE_MAX;
    // One save at a time, so an older snapshot never lands after a newer one.
    saving.current = saving.current.then(async () => {
      const contentHash = await sha256(serialized);
      if (contentHash === lastHash.current) return;
      onStatusChange('saving');
      try {
        await saveSnapshot.mutateAsync({
          canvasId,
          snapshotJson,
          markdown,
          contentHash,
          keepalive,
        });
        lastHash.current = contentHash;
        if (!dirty.current) onStatusChange('saved');
      } catch (error) {
        dirty.current = true;
        onStatusChange('failed');
        toast.error((error as Error).message);
      }
    });
  });

  useEffect(() => {
    const flush = () => save();
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return mergeRegister(
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, tags }) => {
        // Someone else's edit is theirs to save, and the seed is already in Postgres.
        if (tags.has(COLLABORATION_TAG) || tags.has(HISTORY_MERGE_TAG)) return;
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        dirty.current = true;
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, SNAPSHOT_DELAY_MS);
      }),
      () => {
        window.removeEventListener('pagehide', flush);
        document.removeEventListener('visibilitychange', flushWhenHidden);
        flush();
      }
    );
  }, [editor]);

  return null;
}

/**
 * Binds the editor to the canvas's live Yjs document: other people's edits and cursors, per-person undo,
 * the one-time seed of an empty document, a banner while the connection is down, and avatars in the header.
 */
function CanvasEditorLive({
  canvas,
  color,
  deniedReason,
  names,
  cursorsRef,
  presenceSlot,
  onStateChange,
  onStatusChange,
}: {
  canvas: CanvasDocument;
  color: string;
  deniedReason: string | null;
  names: ReadonlyMap<string, string>;
  cursorsRef: RefObject<HTMLDivElement | null>;
  presenceSlot: HTMLElement | null;
  onStateChange: (state: CanvasLiveState) => void;
  onStatusChange: (status: CanvasSaveStatus) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const room = useRoom();
  const status = useStatus();
  const { data: session } = useQuery(sessionQuery);
  const claim = useClaimCanvasBootstrap();
  const canEdit = canvas.access.edit;
  const [synced, setSynced] = useState(false);
  const [seeded, setSeeded] = useState(!canEdit);
  const claiming = useRef(false);

  const providerFactory = useMemo<ProviderFactory>(
    () => (id, docMap) => {
      const yjs = getYjsProviderForRoom(room);
      docMap.set(id, yjs.getYDoc());
      const provider = createLiveblocksYjsAdapter(yjs, {
        getStatus: () => room.getStatus(),
        subscribe: (listener) => room.subscribe('status', listener),
      });
      // Registered before Lexical connects, so the replayed sync is never missed.
      provider.on('sync', (isSynced) => {
        if (isSynced) setSynced(true);
      });
      return provider;
    },
    [room]
  );

  // Whoever finds the live document empty asks to seed it; Postgres lets exactly one of them.
  const seed = useEffectEvent(() => {
    if (claiming.current) return;
    claiming.current = true;
    const root = getYjsProviderForRoom(room).getYDoc().get('root', XmlText);
    if (root.length > 0) {
      setSeeded(true);
      return;
    }
    claim
      .mutateAsync({ canvasId: canvas.id })
      .then((result) => {
        if (result.claimed) seedCanvas(editor, result, names);
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setSeeded(true));
  });

  useEffect(() => {
    if (synced && !seeded) seed();
  }, [synced, seeded]);

  const loaded = synced && seeded;
  const offline =
    deniedReason !== null ||
    status === 'reconnecting' ||
    status === 'disconnected';
  let state: CanvasLiveState = 'loading';
  if (loaded) state = offline ? 'offline' : 'ready';
  useEffect(() => onStateChange(state), [state, onStateChange]);

  return (
    <>
      <CollaborationPlugin
        id={canvas.id}
        providerFactory={providerFactory}
        shouldBootstrap={false}
        username={session?.user.name}
        cursorColor={color}
        cursorsContainerRef={cursorsRef}
      />
      {canEdit && loaded && (
        <CanvasEditorSnapshot
          canvasId={canvas.id}
          onStatusChange={onStatusChange}
        />
      )}
      {deniedReason ? (
        <Alert role="alert" className="animate-canvas-pop-in mb-4">
          <IconPlugConnectedX />
          <AlertTitle>Live editing paused</AlertTitle>
          <AlertDescription>{deniedReason}</AlertDescription>
        </Alert>
      ) : (
        offline && (
          <Alert role="status" className="animate-canvas-pop-in mb-4">
            <IconPlugConnectedX />
            <AlertTitle>Reconnecting to live collaboration…</AlertTitle>
            <AlertDescription>
              {canEdit
                ? 'Editing pauses until you’re back, so nothing you type is lost.'
                : 'New edits will show up once you’re back.'}
            </AlertDescription>
          </Alert>
        )
      )}
      {presenceSlot && createPortal(<CanvasPresenceAvatars />, presenceSlot)}
    </>
  );
}

/**
 * Offers to share a standalone canvas with a member who was just mentioned but cannot open it.
 * Only shown to someone who can manage sharing.
 */
function CanvasEditorSharePrompt({ canvasId }: { canvasId: string }) {
  const [editor] = useLexicalComposerContext();
  const [mentioned, setMentioned] = useState<string[]>([]);
  const { data: members } = useQuery({
    ...canvasMembersQuery(canvasId),
    enabled: mentioned.length > 0,
  });
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const share = useShareCanvas();

  useEffect(
    () =>
      editor.registerMutationListener(
        MentionNode,
        (mutations) => {
          const ids = editor.read(() =>
            [...mutations].flatMap(([key, mutation]) => {
              const node = mutation === 'created' ? $getNodeByKey(key) : null;
              return $isMentionNode(node) ? [node.getUserId()] : [];
            })
          );
          if (ids.length === 0) return;
          setMentioned((current) => [...new Set([...current, ...ids])]);
        },
        { skipInitialization: true }
      ),
    [editor]
  );

  const shared = new Set(members?.map((member) => member.userId));
  const outsider = workspaceMembers.find(
    (member) =>
      member.status === 'active' &&
      mentioned.includes(member.userId) &&
      !shared.has(member.userId)
  );
  if (!members || !outsider) return null;

  const dismiss = () =>
    setMentioned((current) => current.filter((id) => id !== outsider.userId));

  return (
    <Alert role="status" className="mb-4 pr-32">
      <IconUserPlus />
      <AlertTitle>{outsider.name} can&apos;t open this canvas</AlertTitle>
      <AlertDescription>Share it so they can read it.</AlertDescription>
      <AlertAction className="flex items-center gap-1">
        <StatusButton
          variant="outline"
          size="sm"
          status={share.isPending ? 'loading' : 'idle'}
          onClick={() =>
            share.mutate(
              { canvasId, userIds: [outsider.userId], role: 'viewer' },
              {
                onSuccess: () => {
                  toast.success(`Shared with ${outsider.name}.`);
                  dismiss();
                },
                onError: (error) => toast.error(error.message),
              }
            )
          }
        >
          Share
        </StatusButton>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <IconX />
        </Button>
      </AlertAction>
    </Alert>
  );
}

/** Pasting a Conduit message link on its own embeds the message instead of the link. */
function CanvasEditorMessagePaste() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const text =
            event instanceof ClipboardEvent
              ? event.clipboardData?.getData('text/plain')
              : null;
          const messageId =
            text && parseMessageUrl(text, window.location.origin);
          if (!messageId) return false;
          event.preventDefault();
          if (!$getSelection()) $getRoot().selectEnd();
          $insertNodeToNearestRoot($createMessageEmbedNode(messageId));
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
    [editor]
  );

  return null;
}

function CanvasEditorPlugins({
  canvas,
  anchor,
  insertBarSlot,
}: {
  canvas: CanvasDocument;
  anchor: HTMLDivElement | null;
  insertBarSlot: HTMLElement | null;
}) {
  return (
    <>
      <LazyCodeHighlightPlugin />
      <CodeBlockPlugin />
      <LayoutPlugin />
      <CalloutPlugin />
      <TogglePlugin />
      {canvas.access.edit && (
        <>
          <CanvasEditorMessagePaste />
          <CanvasEditorEditPlugins
            canvas={canvas}
            anchor={anchor}
            insertBarSlot={insertBarSlot}
          />
        </>
      )}
    </>
  );
}

/** One heading subscription for both the hash scroll and the outline. */
function CanvasEditorOutline({
  active,
  loading,
  previewing,
  tocSlot,
  compactTocSlot,
}: {
  active: boolean;
  loading: boolean;
  previewing: boolean;
  tocSlot: HTMLElement | null;
  compactTocSlot: HTMLElement | null;
}) {
  const [editor] = useLexicalComposerContext();
  const headings = useCanvasHeadings(editor);

  return (
    <>
      <CanvasTocHashScroll
        headings={headings}
        ready={!loading}
        visible={active && !loading && !previewing}
      />
      {!loading && !previewing && (
        <CanvasToc
          headings={headings}
          slot={tocSlot}
          compactSlot={compactTocSlot}
          side="left"
        />
      )}
    </>
  );
}

function CanvasSnapshotPreviewToc({
  tocSlot,
  compactTocSlot,
}: {
  tocSlot: HTMLElement | null;
  compactTocSlot: HTMLElement | null;
}) {
  const [editor] = useLexicalComposerContext();
  const headings = useCanvasHeadings(editor);

  return (
    <CanvasToc
      headings={headings}
      slot={tocSlot}
      compactSlot={compactTocSlot}
      side="left"
    />
  );
}

function CanvasEditorCommentDraft() {
  const { draft } = useCanvasComments();
  return draft && <CanvasCommentPopover />;
}

const disposedEditors = new WeakSet<LexicalEditorWithDispose>();

// The plugins render around the editable, so the extension does not render its own.
function buildCanvasEditor(
  canvas: CanvasDocument,
  names: ReadonlyMap<string, string>,
  collaborative: boolean
) {
  return buildEditorFromExtensions(
    ReactProviderExtension,
    configExtension(ReactExtension, { contentEditable: null }),
    createCanvasExtension(canvas, names, { collaborative })
  );
}

class CanvasSnapshotPreviewBoundary extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function CanvasSnapshotPreviewEditor({
  canvasId,
  title,
  content,
  names,
  fallback,
  tocSlot,
  compactTocSlot,
}: {
  canvasId: string;
  title: string;
  content: Pick<CanvasDocument, 'snapshotJson' | 'markdown'>;
  names: ReadonlyMap<string, string>;
  fallback: ReactNode;
  tocSlot: HTMLElement | null;
  compactTocSlot: HTMLElement | null;
}) {
  const [editor, setEditor] = useState<LexicalEditorWithDispose | null>(() =>
    tryBuildCanvasPreviewEditor(content, names)
  );
  const renderEmbed = useCallback(
    (messageId: string) => (
      <CanvasMessageEmbed canvasId={canvasId} messageId={messageId} />
    ),
    [canvasId]
  );

  useEffect(() => {
    if (!editor) return;
    if (disposedEditors.has(editor)) {
      setEditor(tryBuildCanvasPreviewEditor(content, names));
      return;
    }
    return () => {
      editor.dispose();
      disposedEditors.add(editor);
    };
  }, [editor, content, names]);

  if (editor === null) return fallback;

  return (
    <MessageEmbedRenderer value={renderEmbed}>
      <LexicalExtensionEditorComposer
        key={editor.getKey()}
        initialEditor={editor}
      >
        <ContentEditable
          aria-label={title}
          aria-readonly
          className="min-h-[50dvh] pb-24 pl-8 leading-7 outline-none"
        />
        <CanvasSnapshotPreviewToc
          tocSlot={tocSlot}
          compactTocSlot={compactTocSlot}
        />
        <LazyCodeHighlightPlugin />
        <CodeBlockPlugin />
        <LayoutPlugin />
        <CalloutPlugin />
        <TogglePlugin />
      </LexicalExtensionEditorComposer>
    </MessageEmbedRenderer>
  );
}

/** Read-only Postgres snapshot rendered while Liveblocks auth and initial Yjs sync complete. */
function CanvasSnapshotPreview({
  canvas,
  names,
  fallback,
  tocSlot,
  compactTocSlot,
}: {
  canvas: CanvasDocument;
  names: ReadonlyMap<string, string>;
  fallback: ReactNode;
  tocSlot: HTMLElement | null;
  compactTocSlot: HTMLElement | null;
}) {
  const [initial] = useState(canvas);
  const [mode, setMode] = useState<'snapshot' | 'markdown' | 'fallback'>(() => {
    if (initial.snapshotJson !== null) return 'snapshot';
    return initial.markdown.length > 0 ? 'markdown' : 'fallback';
  });
  const markdownContent = useMemo(
    () => ({ snapshotJson: null, markdown: initial.markdown }),
    [initial.markdown]
  );

  if (mode === 'fallback') return fallback;

  const content = mode === 'snapshot' ? initial : markdownContent;
  const handleError = () =>
    setMode((current) =>
      current === 'snapshot' && initial.markdown.length > 0
        ? 'markdown'
        : 'fallback'
    );

  return (
    <CanvasSnapshotPreviewBoundary
      key={mode}
      fallback={fallback}
      onError={handleError}
    >
      <CanvasSnapshotPreviewEditor
        key={mode}
        canvasId={canvas.id}
        title={canvas.title}
        content={content}
        names={names}
        fallback={fallback}
        tocSlot={tocSlot}
        compactTocSlot={compactTocSlot}
      />
    </CanvasSnapshotPreviewBoundary>
  );
}

/**
 * The canvas document, with a floating toolbar on selection, a `/` block menu, and a drag handle per block.
 * There is no fixed toolbar. Loaded on demand, so a channel's first load does not carry the editor.
 * Edited live with everyone else on it when the server has Liveblocks, and saved by its one editor when not.
 */
export function CanvasEditor({
  canvas,
  auth,
  active = true,
  fallback,
  presenceSlot,
  tocSlot,
  compactTocSlot,
  ...props
}: Omit<
  CanvasEditorDocumentProps,
  'namesAtMount' | 'active' | 'onLiveLoadingChange' | 'onPreviewingChange'
> & {
  /** Read once, when the editor mounts. Remount with a `key` to open another canvas. */
  canvas: CanvasDocument;
  auth: CanvasLiveblocksAuthState;
  active?: boolean;
}) {
  const { data: workspaceMembers } = useWorkspaceMembers();
  // Names only label mentions in Markdown without a saved state, so a later members refresh must not rebuild.
  const [namesAtMount] = useState<ReadonlyMap<string, string>>(
    () => new Map(workspaceMembers?.map((m) => [m.userId, m.name]))
  );
  const [liveLoading, setLiveLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const showSnapshotPreview =
    auth.isPending ||
    (!auth.isError && auth.data.enabled && liveLoading && !previewing);

  return (
    <>
      {showSnapshotPreview && (
        <CanvasSnapshotPreview
          canvas={canvas}
          names={namesAtMount}
          fallback={fallback}
          tocSlot={tocSlot}
          compactTocSlot={compactTocSlot}
        />
      )}
      <CanvasCollabProvider canvasId={canvas.id} auth={auth} fallback={null}>
        <CanvasEditorDocument
          canvas={canvas}
          active={active}
          fallback={fallback}
          namesAtMount={namesAtMount}
          presenceSlot={presenceSlot}
          tocSlot={tocSlot}
          compactTocSlot={compactTocSlot}
          onLiveLoadingChange={setLiveLoading}
          onPreviewingChange={setPreviewing}
          {...props}
        />
      </CanvasCollabProvider>
    </>
  );
}

type CanvasEditorDocumentProps = {
  canvas: CanvasDocument;
  active: boolean;
  /** Skeleton shown while auth completes, while a history version is loading, or when no snapshot preview can be built. */
  fallback: ReactNode;
  namesAtMount: ReadonlyMap<string, string>;
  /** Where the avatars of everyone else on a live canvas render. */
  presenceSlot: HTMLElement | null;
  /** Where the outline of the canvas's headings renders. */
  tocSlot: HTMLElement | null;
  /** Where the narrow-screen outline trigger renders in the canvas chrome. */
  compactTocSlot: HTMLElement | null;
  /** Where the bar of blocks to insert renders, for editors. */
  insertBarSlot: HTMLElement | null;
  commentsOpen: boolean;
  onCommentsOpenChange: (open: boolean) => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  savingVersion: boolean;
  onSavingVersionChange: (open: boolean) => void;
  onStatusChange: (status: CanvasSaveStatus) => void;
  onLiveLoadingChange: (loading: boolean) => void;
  onPreviewingChange: (previewing: boolean) => void;
  /** Hands the editor out, so the heading outside it can move the caret into the document. */
  onEditorChange?: (editor: LexicalEditor | null) => void;
  /** Hands out the editor currently on screen for Markdown export (live or version preview). */
  onExportChange?: (state: {
    editor: LexicalEditor | null;
    disabled: boolean;
  }) => void;
};

const noop = () => {};

function CanvasEditorDocument({
  canvas,
  active,
  fallback,
  namesAtMount,
  presenceSlot,
  tocSlot,
  compactTocSlot,
  insertBarSlot,
  commentsOpen,
  onCommentsOpenChange,
  historyOpen,
  onHistoryOpenChange,
  savingVersion,
  onSavingVersionChange,
  onStatusChange,
  onLiveLoadingChange,
  onPreviewingChange,
  onEditorChange,
  onExportChange,
}: CanvasEditorDocumentProps) {
  const collab = useCanvasCollab();
  const [initial] = useState(canvas);
  const [editor, setEditor] = useState(() =>
    buildCanvasEditor(initial, namesAtMount, collab.live)
  );
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const cursorsRef = useRef<HTMLDivElement | null>(null);
  const [liveState, setLiveState] = useState<CanvasLiveState>('loading');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewEditor, setPreviewEditor] = useState<LexicalEditor | null>(
    null
  );
  const handleLiveStateChange = useCallback(
    (next: CanvasLiveState) => {
      setLiveState(next);
      onLiveLoadingChange(next === 'loading');
    },
    [onLiveLoadingChange]
  );
  const loading = collab.live && liveState === 'loading';
  const editable =
    canvas.access.edit && (!collab.live || liveState === 'ready');
  const commentsOpened = useOpenedOnce(commentsOpen);
  const historyOpened = useOpenedOnce(historyOpen);
  const saveVersionOpened = useOpenedOnce(savingVersion);
  const Comments = collab.live
    ? CanvasCommentsPluginLive
    : CanvasCommentsPlugin;

  const renderEmbed = useCallback(
    (messageId: string) => (
      <CanvasMessageEmbed canvasId={canvas.id} messageId={messageId} />
    ),
    [canvas.id]
  );

  if (!historyOpen && previewId) setPreviewId(null);
  const notifyVersions = useRef<() => void>(noop);

  const preview = (versionId: string | null) => {
    setPreviewId(versionId);
    // Leaving a preview hands the keyboard back to the document.
    if (!versionId) requestAnimationFrame(() => editor.focus());
  };

  // Every effect cleanup disposes the editor, and a disposed editor ignores typing, so a remount builds a new one.
  useEffect(() => {
    if (disposedEditors.has(editor)) {
      setEditor(buildCanvasEditor(initial, namesAtMount, collab.live));
      return;
    }
    return () => {
      editor.dispose();
      disposedEditors.add(editor);
    };
  }, [editor, initial, namesAtMount, collab.live]);

  useEffect(() => {
    onPreviewingChange(previewId !== null);
  }, [previewId, onPreviewingChange]);

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    onEditorChange?.(loading ? null : editor);
    return () => onEditorChange?.(null);
  }, [editor, loading, onEditorChange]);

  useEffect(() => {
    let activeEditor: LexicalEditor | null = null;
    if (previewId) {
      activeEditor = previewEditor;
    } else if (!loading) {
      activeEditor = editor;
    }
    onExportChange?.({
      editor: activeEditor,
      disabled: Boolean(previewId) && !previewEditor,
    });
  }, [editor, loading, previewId, previewEditor, onExportChange]);

  useEffect(
    () => () => onExportChange?.({ editor: null, disabled: false }),
    [onExportChange]
  );

  const composer = (
    <MessageEmbedRenderer value={renderEmbed}>
      <LexicalExtensionEditorComposer
        key={editor.getKey()}
        initialEditor={editor}
      >
        <Comments
          canvasId={canvas.id}
          canComment={canvas.access.comment && editable}
          panelOpen={commentsOpen}
          onPanelOpenChange={onCommentsOpenChange}
        >
          {collab.live ? (
            <CanvasEditorLive
              canvas={canvas}
              color={collab.color}
              deniedReason={collab.deniedReason}
              names={namesAtMount}
              cursorsRef={cursorsRef}
              presenceSlot={presenceSlot}
              onStateChange={handleLiveStateChange}
              onStatusChange={onStatusChange}
            />
          ) : (
            editable && (
              <CanvasEditorAutosave
                canvasId={canvas.id}
                onStatusChange={onStatusChange}
              />
            )
          )}
          {editable && !canvas.roomId && canvas.access.manageSharing && (
            <CanvasEditorSharePrompt canvasId={canvas.id} />
          )}
          <CanvasEditorPlugins
            canvas={canvas}
            anchor={anchor}
            insertBarSlot={!loading && !previewId ? insertBarSlot : null}
          />
          <CanvasEditorOutline
            active={active}
            loading={loading}
            previewing={previewId !== null}
            tocSlot={tocSlot}
            compactTocSlot={compactTocSlot}
          />
          {previewId && (
            <CanvasHistoryPreview
              canvasId={canvas.id}
              versionId={previewId}
              editor={editor}
              canRestore={editable}
              fallback={fallback}
              onExit={() => preview(null)}
              onRestored={() => {
                notifyVersions.current();
                preview(null);
              }}
              onPreviewEditorChange={setPreviewEditor}
            />
          )}
          <div
            ref={(element) => {
              cursorsRef.current = element;
              setAnchor(element);
            }}
            hidden={loading || previewId !== null}
            className="relative"
          >
            <ContentEditable
              aria-label={canvas.title}
              aria-placeholder="Type / for blocks"
              aria-readonly={!editable}
              placeholder={
                <div className="text-muted-foreground pointer-events-none absolute top-0 left-8 leading-7 select-none">
                  Type / for blocks, @ to mention someone
                </div>
              }
              className="min-h-[50dvh] pb-24 pl-8 leading-7 outline-none"
            />
            {editable && <CanvasTemplatePicker canvas={canvas} />}
          </div>
          <CanvasEditorCommentDraft />
          {commentsOpened && <CanvasCommentsPanel />}
          {historyOpened && (
            <CanvasHistoryPanel
              canvasId={canvas.id}
              canEdit={canvas.access.edit}
              open={historyOpen}
              onOpenChange={onHistoryOpenChange}
              previewId={previewId}
              onPreview={preview}
              onSaveVersion={() => onSavingVersionChange(true)}
            />
          )}
          {collab.live && (
            <CanvasHistoryPanelSync
              canvasId={canvas.id}
              notifyRef={notifyVersions}
            />
          )}
          {canvas.access.edit && saveVersionOpened && (
            <CanvasSaveVersionDialog
              canvasId={canvas.id}
              open={savingVersion}
              onOpenChange={onSavingVersionChange}
              onSaved={() => notifyVersions.current()}
            />
          )}
        </Comments>
      </LexicalExtensionEditorComposer>
    </MessageEmbedRenderer>
  );

  return collab.live ? (
    <LexicalCollaboration>{composer}</LexicalCollaboration>
  ) : (
    composer
  );
}
