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
import {
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
import { CodeBlockPlugin } from '@/components/editor/plugins/code-block-plugin';
import { CodeHighlightPlugin } from '@/components/editor/plugins/code-highlight-plugin';
import { ComponentPickerMenuPlugin } from '@/components/editor/plugins/component-picker-menu-plugin';
import { DraggableBlockPlugin } from '@/components/editor/plugins/draggable-block-plugin';
import { EmojiPickerPlugin } from '@/components/editor/plugins/emoji-picker-plugin';
import { FloatingLinkEditorPlugin } from '@/components/editor/plugins/floating-link-editor-plugin';
import { FloatingTextFormatToolbarPlugin } from '@/components/editor/plugins/floating-text-format-plugin';
import { LayoutPlugin } from '@/components/editor/plugins/layout-plugin';
import {
  Mention,
  MentionAvatar,
  MentionContent,
  MentionFooter,
  MentionHint,
  MentionItem,
  MentionLabel,
  MentionPortal,
} from '@/components/editor/plugins/mentions-plugin';
import { BulletedListPickerPlugin } from '@/components/editor/plugins/picker/bulleted-list-picker-plugin';
import { CheckListPickerPlugin } from '@/components/editor/plugins/picker/check-list-picker-plugin';
import { CodePickerPlugin } from '@/components/editor/plugins/picker/code-picker-plugin';
import { ColumnsLayoutPickerPlugin } from '@/components/editor/plugins/picker/columns-layout-picker-plugin';
import { DividerPickerPlugin } from '@/components/editor/plugins/picker/divider-picker-plugin';
import { HeadingPickerPlugin } from '@/components/editor/plugins/picker/heading-picker-plugin';
import { MessageEmbedPickerPlugin } from '@/components/editor/plugins/picker/message-embed-picker-plugin';
import { NumberedListPickerPlugin } from '@/components/editor/plugins/picker/numbered-list-picker-plugin';
import { ParagraphPickerPlugin } from '@/components/editor/plugins/picker/paragraph-picker-plugin';
import { QuotePickerPlugin } from '@/components/editor/plugins/picker/quote-picker-plugin';
import {
  DynamicTablePickerPlugin,
  TablePickerPlugin,
} from '@/components/editor/plugins/picker/table-picker-plugin';
import { sessionQuery } from '@/services/auth/queries';
import {
  useClaimCanvasBootstrap,
  useSaveCanvasSnapshot,
  useShareCanvas,
  useUpdateCanvas,
} from '@/services/canvases/hooks';
import { canvasMembersQuery } from '@/services/canvases/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import {
  $seedCanvasFromMarkdown,
  canvasMarkdownOf,
  createCanvasExtension,
} from '../lib/canvas-extension';
import { createLiveblocksYjsAdapter } from '../lib/liveblocks-yjs-adapter';
import { parseMessageUrl } from '../lib/message-url';
import {
  CanvasCollabProvider,
  useCanvasCollab,
} from './canvas-collab-provider';
import {
  CanvasCommentPopover,
  CanvasCommentPopoverButton,
} from './canvas-comment-popover';
import { CanvasCommentsPanel } from './canvas-comments-panel';
import {
  CanvasCommentsPlugin,
  CanvasCommentsPluginLive,
} from './canvas-comments-plugin';
import {
  CanvasHistoryPanel,
  CanvasHistoryPanelSync,
} from './canvas-history-panel';
import { CanvasHistoryPreview } from './canvas-history-preview';
import { CanvasMessageEmbed } from './canvas-message-embed';
import { CanvasMessagePickerDialog } from './canvas-message-picker-dialog';
import { CanvasPresenceAvatars } from './canvas-presence-avatars';
import { CanvasSaveVersionDialog } from './canvas-save-version-dialog';

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
    { tag: HISTORY_MERGE_TAG }
  );
}

/** The `/` menu, in the order a document is usually built. */
function canvasBlockOptions(pickMessage: () => void) {
  return [
    ParagraphPickerPlugin(),
    HeadingPickerPlugin({ n: 1 }),
    HeadingPickerPlugin({ n: 2 }),
    HeadingPickerPlugin({ n: 3 }),
    BulletedListPickerPlugin(),
    NumberedListPickerPlugin(),
    CheckListPickerPlugin(),
    QuotePickerPlugin(),
    CodePickerPlugin(),
    DividerPickerPlugin(),
    TablePickerPlugin(),
    ColumnsLayoutPickerPlugin(),
    MessageEmbedPickerPlugin({ onSelect: pickMessage }),
  ];
}

function $insertMessageEmbed(messageId: string) {
  // Closing a dialog leaves the editor blurred with no active selection.
  if (!$getSelection()) $getRoot().selectEnd();
  $insertNodeToNearestRoot($createMessageEmbedNode(messageId));
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
          $insertMessageEmbed(messageId);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
    [editor]
  );

  return null;
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
  const { data: members } = useQuery(canvasMembersQuery(canvasId));
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const share = useShareCanvas();
  const [mentioned, setMentioned] = useState<string[]>([]);

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

function CanvasEditorPlugins({
  canvas,
  anchor,
}: {
  canvas: CanvasDocument;
  anchor: HTMLDivElement | null;
}) {
  const [editor] = useLexicalComposerContext();
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);
  const [pickingMessage, setPickingMessage] = useState(false);
  const { data: session } = useQuery(sessionQuery);
  const { data: workspaceMembers } = useWorkspaceMembers();
  const blockOptions = useMemo(
    () => canvasBlockOptions(() => setPickingMessage(true)),
    []
  );
  const viewerId = session?.user.id;
  // A canvas never notifies a whole channel, so `@channel` and `@here` are not offered.
  const suggestions = useMemo(
    () =>
      (workspaceMembers ?? [])
        .filter((member) => member.status === 'active')
        .map(({ userId, name, email, image }) => ({
          id: userId,
          name,
          detail: email,
          image,
          hint: userId === viewerId ? 'You' : undefined,
        })),
    [workspaceMembers, viewerId]
  );

  return (
    <>
      <CodeHighlightPlugin />
      <CodeBlockPlugin />
      <LayoutPlugin />
      <Mention source={suggestions}>
        <MentionPortal>
          <MentionContent>
            {() => (
              <MentionItem>
                <MentionAvatar />
                <MentionLabel />
                <MentionHint />
              </MentionItem>
            )}
          </MentionContent>
          <MentionFooter />
        </MentionPortal>
      </Mention>
      <EmojiPickerPlugin />
      <ComponentPickerMenuPlugin
        baseOptions={blockOptions}
        dynamicOptionsFn={DynamicTablePickerPlugin}
      />
      {canvas.access.edit && (
        <>
          <FloatingTextFormatToolbarPlugin
            anchorElem={anchor}
            setIsLinkEditMode={setIsLinkEditMode}
            trailing={canvas.access.comment && <CanvasCommentPopoverButton />}
          />
          <FloatingLinkEditorPlugin
            anchorElem={anchor}
            isLinkEditMode={isLinkEditMode}
            setIsLinkEditMode={setIsLinkEditMode}
          />
          <DraggableBlockPlugin
            anchorElem={anchor}
            baseOptions={blockOptions}
            dynamicOptionsFn={DynamicTablePickerPlugin}
          />
          <CanvasEditorMessagePaste />
          <CanvasMessagePickerDialog
            open={pickingMessage}
            onOpenChange={setPickingMessage}
            onPick={(messageId) =>
              editor.update(() => $insertMessageEmbed(messageId))
            }
          />
        </>
      )}
    </>
  );
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

/**
 * The canvas document, with a floating toolbar on selection, a `/` block menu, and a drag handle per block.
 * There is no fixed toolbar. Loaded on demand, so a channel's first load does not carry the editor.
 * Edited live with everyone else on it when the server has Liveblocks, and saved by its one editor when not.
 */
export function CanvasEditor({
  canvas,
  fallback,
  presenceSlot,
  ...props
}: CanvasEditorDocumentProps & {
  /** Read once, when the editor mounts. Remount with a `key` to open another canvas. */
  canvas: CanvasDocument;
}) {
  return (
    <CanvasCollabProvider canvasId={canvas.id} fallback={fallback}>
      <CanvasEditorDocument
        canvas={canvas}
        fallback={fallback}
        presenceSlot={presenceSlot}
        {...props}
      />
    </CanvasCollabProvider>
  );
}

type CanvasEditorDocumentProps = {
  canvas: CanvasDocument;
  /** Shown until the live document is ready. */
  fallback: ReactNode;
  /** Where the avatars of everyone else on a live canvas render. */
  presenceSlot: HTMLElement | null;
  commentsOpen: boolean;
  onCommentsOpenChange: (open: boolean) => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  savingVersion: boolean;
  onSavingVersionChange: (open: boolean) => void;
  onStatusChange: (status: CanvasSaveStatus) => void;
};

const noop = () => {};

function CanvasEditorDocument({
  canvas,
  fallback,
  presenceSlot,
  commentsOpen,
  onCommentsOpenChange,
  historyOpen,
  onHistoryOpenChange,
  savingVersion,
  onSavingVersionChange,
  onStatusChange,
}: CanvasEditorDocumentProps) {
  const collab = useCanvasCollab();
  const { data: workspaceMembers } = useWorkspaceMembers();
  const names = useMemo(
    () => new Map(workspaceMembers?.map((m) => [m.userId, m.name])),
    [workspaceMembers]
  );
  // Names only label mentions in Markdown without a saved state, so a later members refresh must not rebuild.
  const [namesAtMount] = useState(names);
  const [initial] = useState(canvas);
  const [editor, setEditor] = useState(() =>
    buildCanvasEditor(initial, namesAtMount, collab.live)
  );
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const cursorsRef = useRef<HTMLDivElement | null>(null);
  const [liveState, setLiveState] = useState<CanvasLiveState>('loading');
  const loading = collab.live && liveState === 'loading';
  const editable =
    canvas.access.edit && (!collab.live || liveState === 'ready');
  const renderEmbed = useCallback(
    (messageId: string) => (
      <CanvasMessageEmbed canvasId={canvas.id} messageId={messageId} />
    ),
    [canvas.id]
  );
  const Comments = collab.live
    ? CanvasCommentsPluginLive
    : CanvasCommentsPlugin;
  const [previewId, setPreviewId] = useState<string | null>(null);
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
    editor.setEditable(editable);
  }, [editor, editable]);

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
              onStateChange={setLiveState}
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
          <CanvasEditorPlugins canvas={canvas} anchor={anchor} />
          {loading && fallback}
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
          </div>
          <CanvasCommentPopover />
          <CanvasCommentsPanel />
          <CanvasHistoryPanel
            canvasId={canvas.id}
            canEdit={canvas.access.edit}
            open={historyOpen}
            onOpenChange={onHistoryOpenChange}
            previewId={previewId}
            onPreview={preview}
            onSaveVersion={() => onSavingVersionChange(true)}
          />
          {collab.live && (
            <CanvasHistoryPanelSync
              canvasId={canvas.id}
              notifyRef={notifyVersions}
            />
          )}
          {canvas.access.edit && (
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
