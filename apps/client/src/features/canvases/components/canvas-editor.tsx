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
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionEditorComposer } from '@lexical/react/LexicalExtensionEditorComposer';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { ReactProviderExtension } from '@lexical/react/ReactProviderExtension';
import { mergeRegister } from '@lexical/utils';
import { IconUserPlus, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  $getNodeByKey,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  configExtension,
  type LexicalEditorWithDispose,
} from 'lexical';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  $isMentionNode,
  MentionNode,
} from '@/components/editor/nodes/mention-node';
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
import { NumberedListPickerPlugin } from '@/components/editor/plugins/picker/numbered-list-picker-plugin';
import { ParagraphPickerPlugin } from '@/components/editor/plugins/picker/paragraph-picker-plugin';
import { QuotePickerPlugin } from '@/components/editor/plugins/picker/quote-picker-plugin';
import {
  DynamicTablePickerPlugin,
  TablePickerPlugin,
} from '@/components/editor/plugins/picker/table-picker-plugin';
import { sessionQuery } from '@/services/auth/queries';
import { useShareCanvas, useUpdateCanvas } from '@/services/canvases/hooks';
import { canvasMembersQuery } from '@/services/canvases/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import {
  canvasMarkdownOf,
  createCanvasExtension,
} from '../lib/canvas-extension';

export type CanvasSaveStatus = 'saved' | 'saving' | 'failed';

const SAVE_DELAY_MS = 1000;

/** The `/` menu, in the order a document is usually built. */
function canvasBlockOptions() {
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
  ];
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
        <Button
          variant="outline"
          size="sm"
          disabled={share.isPending}
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
        </Button>
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
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);
  const { data: session } = useQuery(sessionQuery);
  const { data: workspaceMembers } = useWorkspaceMembers();
  const blockOptions = useMemo(canvasBlockOptions, []);
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
        </>
      )}
    </>
  );
}

const disposedEditors = new WeakSet<LexicalEditorWithDispose>();

// The plugins render around the editable, so the extension does not render its own.
function buildCanvasEditor(
  canvas: CanvasDocument,
  names: ReadonlyMap<string, string>
) {
  return buildEditorFromExtensions(
    ReactProviderExtension,
    configExtension(ReactExtension, { contentEditable: null }),
    createCanvasExtension(canvas, names)
  );
}

/**
 * The canvas document, with a floating toolbar on selection, a `/` block menu, and a drag handle per block.
 * There is no fixed toolbar. Loaded on demand, so a channel's first load does not carry the editor.
 */
export function CanvasEditor({
  canvas,
  onStatusChange,
}: {
  /** Read once, when the editor mounts. Remount with a `key` to open another canvas. */
  canvas: CanvasDocument;
  onStatusChange: (status: CanvasSaveStatus) => void;
}) {
  const { data: workspaceMembers } = useWorkspaceMembers();
  const names = useMemo(
    () => new Map(workspaceMembers?.map((m) => [m.userId, m.name])),
    [workspaceMembers]
  );
  // Names only label mentions in Markdown without a saved state, so a later members refresh must not rebuild.
  const [namesAtMount] = useState(names);
  const [initial] = useState(canvas);
  const [editor, setEditor] = useState(() =>
    buildCanvasEditor(initial, namesAtMount)
  );
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const editable = canvas.access.edit;

  // Every effect cleanup disposes the editor, and a disposed editor ignores typing, so a remount builds a new one.
  useEffect(() => {
    if (disposedEditors.has(editor)) {
      setEditor(buildCanvasEditor(initial, namesAtMount));
      return;
    }
    return () => {
      editor.dispose();
      disposedEditors.add(editor);
    };
  }, [editor, initial, namesAtMount]);

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <LexicalExtensionEditorComposer
      key={editor.getKey()}
      initialEditor={editor}
    >
      {editable && (
        <CanvasEditorAutosave
          canvasId={canvas.id}
          onStatusChange={onStatusChange}
        />
      )}
      {editable && !canvas.roomId && canvas.access.manageSharing && (
        <CanvasEditorSharePrompt canvasId={canvas.id} />
      )}
      <CanvasEditorPlugins canvas={canvas} anchor={anchor} />
      <div ref={setAnchor} className="relative">
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
    </LexicalExtensionEditorComposer>
  );
}
