'use client';

import { CANVAS_QUOTE_MAX } from '@conduit/contract';
import {
  $isMarkNode,
  $unwrapMarkNode,
  $wrapSelectionInMarkNode,
  MarkNode,
} from '@lexical/mark';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { useBroadcastEvent, useEventListener } from '@liveblocks/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  type NodeKey,
  type RangeSelection,
} from 'lexical';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { canvasCommentsQuery } from '@/services/canvases/queries';

/** A comment being written on a selection: from the toolbar's button, or from Ctrl+Alt+M. */
export type CanvasCommentDraft = {
  trigger: 'toolbar' | 'keyboard';
  selection: RangeSelection;
  quote: string;
  rect: DOMRect;
};

type CanvasComments = {
  canvasId: string;
  canComment: boolean;
  draft: CanvasCommentDraft | null;
  startDraft: (trigger: CanvasCommentDraft['trigger']) => void;
  cancelDraft: () => void;
  /** Highlights the drafted passage as the thread's, once the server has stored it. */
  markDraft: (threadId: string) => void;
  activeThreadId: string | null;
  /** Makes the thread the active one, scrolls to its passage, and opens the panel. */
  openThread: (threadId: string) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Threads whose passage is still in the document. */
  markedThreadIds: ReadonlySet<string>;
  /** Removes the thread's highlight, keeping the text. */
  unmarkThread: (threadId: string) => void;
  /** Tells everyone else on a live canvas to refetch the comments. */
  notify: () => void;
};

const CanvasCommentsContext = createContext<CanvasComments | null>(null);

export function useCanvasComments() {
  const context = use(CanvasCommentsContext);
  if (!context) {
    throw new Error(
      'useCanvasComments must be used within CanvasCommentsPlugin.'
    );
  }
  return context;
}

const ACTIVE = 'editor-mark-active';

/**
 * Binds comment threads to the passages they are about. A passage is a `MarkNode` holding its thread's id, which
 * Yjs syncs like any other edit. Clicking a passage opens its thread, and Ctrl+Alt+M comments on the selection.
 */
export function CanvasCommentsPlugin({
  canvasId,
  canComment,
  panelOpen,
  onPanelOpenChange,
  notify = noop,
  children,
}: {
  canvasId: string;
  canComment: boolean;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  notify?: () => void;
  children: ReactNode;
}) {
  const [editor] = useLexicalComposerContext();
  const [draft, setDraft] = useState<CanvasCommentDraft | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [markedThreadIds, setMarkedThreadIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const marks = useRef(new Map<NodeKey, string[]>());
  const active = useRef<string | null>(null);

  const paint = useCallback(() => {
    for (const [key, ids] of marks.current) {
      editor
        .getElementByKey(key)
        ?.classList.toggle(
          ACTIVE,
          active.current !== null && ids.includes(active.current)
        );
    }
  }, [editor]);

  const $startDraft = useCallback((trigger: CanvasCommentDraft['trigger']) => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
    const quote = selection.getTextContent().trim();
    const range = window.getSelection();
    if (!quote || !range?.rangeCount) return;
    setDraft({
      trigger,
      selection: selection.clone(),
      quote: quote.slice(0, CANVAS_QUOTE_MAX),
      rect: range.getRangeAt(0).getBoundingClientRect(),
    });
  }, []);

  const openThread = useCallback(
    (threadId: string) => {
      active.current = threadId;
      setActiveThreadId(threadId);
      paint();
      onPanelOpenChange(true);
      const key = [...marks.current].find(([, ids]) =>
        ids.includes(threadId)
      )?.[0];
      if (key) {
        editor.getElementByKey(key)?.scrollIntoView({ block: 'nearest' });
      }
    },
    [editor, paint, onPanelOpenChange]
  );

  useEffect(
    () =>
      mergeRegister(
        editor.registerMutationListener(MarkNode, (mutations) => {
          editor.getEditorState().read(() => {
            for (const [key, mutation] of mutations) {
              const node = $getNodeByKey(key);
              if (mutation === 'destroyed' || !$isMarkNode(node)) {
                marks.current.delete(key);
              } else {
                marks.current.set(key, node.getIDs());
              }
            }
          });
          setMarkedThreadIds(new Set([...marks.current.values()].flat()));
          paint();
        }),
        editor.registerCommand(
          CLICK_COMMAND,
          (event) => {
            const element =
              event.target instanceof Element
                ? event.target.closest('.editor-mark')
                : null;
            const node = element && $getNearestNodeFromDOMNode(element);
            const id = $isMarkNode(node) ? node.getIDs()[0] : undefined;
            if (id) openThread(id);
            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          KEY_DOWN_COMMAND,
          (event) => {
            const shortcut =
              (event.ctrlKey || event.metaKey) &&
              event.altKey &&
              event.code === 'KeyM';
            if (!shortcut || !canComment) return false;
            event.preventDefault();
            $startDraft('keyboard');
            return true;
          },
          COMMAND_PRIORITY_LOW
        )
      ),
    [editor, paint, openThread, canComment, $startDraft]
  );

  const value = useMemo<CanvasComments>(
    () => ({
      canvasId,
      canComment,
      draft,
      startDraft: (trigger) => editor.read(() => $startDraft(trigger)),
      cancelDraft: () => setDraft(null),
      markDraft: (threadId) => {
        if (!draft) return;
        editor.update(() => {
          const selection = draft.selection.clone();
          try {
            $wrapSelectionInMarkNode(
              selection,
              selection.isBackward(),
              threadId
            );
          } catch {
            // Someone deleted the passage while the comment was written; the thread keeps its quote.
          }
        });
      },
      activeThreadId,
      openThread,
      panelOpen,
      setPanelOpen: onPanelOpenChange,
      markedThreadIds,
      unmarkThread: (threadId) =>
        editor.update(() => {
          for (const [key, ids] of marks.current) {
            if (!ids.includes(threadId)) continue;
            const node = $getNodeByKey(key);
            if (!$isMarkNode(node)) continue;
            node.deleteID(threadId);
            if (node.getIDs().length === 0) $unwrapMarkNode(node);
          }
        }),
      notify,
    }),
    [
      canvasId,
      canComment,
      draft,
      editor,
      $startDraft,
      activeThreadId,
      openThread,
      panelOpen,
      onPanelOpenChange,
      markedThreadIds,
      notify,
    ]
  );

  return (
    <CanvasCommentsContext value={value}>{children}</CanvasCommentsContext>
  );
}

function noop() {}

/** `CanvasCommentsPlugin` on a live canvas: each change is broadcast, and each one heard refetches the comments. */
export function CanvasCommentsPluginLive(
  props: Omit<Parameters<typeof CanvasCommentsPlugin>[0], 'notify'>
) {
  const broadcast = useBroadcastEvent();
  const queryClient = useQueryClient();
  const { queryKey } = canvasCommentsQuery(props.canvasId);

  useEventListener(({ event }) => {
    if (event.type === 'COMMENTS_CHANGED') {
      void queryClient.invalidateQueries({ queryKey });
    }
  });

  const notify = useCallback(
    () => broadcast({ type: 'COMMENTS_CHANGED' }),
    [broadcast]
  );
  return <CanvasCommentsPlugin {...props} notify={notify} />;
}
