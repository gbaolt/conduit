import { CodeExtension, CodeNode } from '@lexical/code';
import {
  buildEditorFromExtensions,
  HorizontalRuleExtension,
  TabIndentationExtension,
} from '@lexical/extension';
import { HistoryExtension } from '@lexical/history';
import { LinkExtension } from '@lexical/link';
import { CheckListExtension, ListExtension } from '@lexical/list';
import { MarkExtension } from '@lexical/mark';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_STAR,
  CHECK_LIST,
  CODE,
  type ElementTransformer,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  type TextMatchTransformer,
  type Transformer,
  UNORDERED_LIST,
} from '@lexical/markdown';
import {
  $isHeadingNode,
  HeadingNode,
  RichTextExtension,
} from '@lexical/rich-text';
import { TableExtension } from '@lexical/table';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $hasUpdateTag,
  $isParagraphNode,
  $nodesOfType,
  $parseSerializedNode,
  COLLABORATION_TAG,
  configExtension,
  defineExtension,
  type EditorThemeClasses,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  type LexicalEditor,
  type NodeKey,
  PASTE_TAG,
  type SerializedEditorState,
} from 'lexical';

import { AutoLinkExtension } from '@/components/editor/extensions/auto-link-extension';
import { EmojisExtension } from '@/components/editor/extensions/emojis-extension';
import { MarkdownShortcutsExtension } from '@/components/editor/extensions/markdown-shortcuts-extension';
import { CalloutNode } from '@/components/editor/nodes/callout-node';
import { CodeBlockNode } from '@/components/editor/nodes/code-block-node';
import {
  $isLayoutContainerNode,
  LayoutContainerNode,
} from '@/components/editor/nodes/layout-container-node';
import {
  $isLayoutItemNode,
  LayoutItemNode,
} from '@/components/editor/nodes/layout-item-node';
import {
  $isMentionNode,
  MentionNode,
} from '@/components/editor/nodes/mention-node';
import {
  $isMessageEmbedNode,
  MessageEmbedNode,
} from '@/components/editor/nodes/message-embed-node';
import {
  ToggleContentNode,
  ToggleNode,
  ToggleTitleNode,
} from '@/components/editor/nodes/toggle-node';
import { editorTheme } from '@/components/editor/themes/editor-theme';
import { CALLOUT } from '@/components/editor/transformers/markdown-callout-transformer';
import { HR } from '@/components/editor/transformers/markdown-hr-transformer';
import { createTableTransformer } from '@/components/editor/transformers/markdown-table-transformer';
import { createToggleTransformer } from '@/components/editor/transformers/markdown-toggle-transformer';
import { createMentionTransformer } from '@/features/messages/lib/mention-transformer';

import {
  $getHeadingAnchorId,
  $setHeadingAnchorId,
  createHeadingAnchorId,
} from './canvas-heading-anchor';

/** The kit's theme at document scale: calmer headings and tighter paragraphs than a landing page. */
const canvasTheme: EditorThemeClasses = {
  ...editorTheme,
  paragraph: 'leading-7 [&:not(:first-child)]:mt-3',
  heading: {
    ...editorTheme.heading,
    h1: 'scroll-m-20 text-3xl font-semibold tracking-tight [&:not(:first-child)]:mt-8',
    h2: 'scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight [&:not(:first-child)]:mt-8',
    h3: 'scroll-m-20 text-xl font-semibold tracking-tight [&:not(:first-child)]:mt-6',
  },
  quote:
    'border-border text-muted-foreground border-l-2 pl-4 [&:not(:first-child)]:mt-3',
  callout: {
    base: 'flex gap-2 rounded-lg py-2 pr-4 pl-2 [&:not(:first-child)]:mt-3 data-[tone=blue]:bg-blue-500/10 data-[tone=gray]:bg-muted data-[tone=green]:bg-emerald-500/10 data-[tone=purple]:bg-violet-500/10 data-[tone=red]:bg-red-500/10 data-[tone=yellow]:bg-amber-500/10',
    icon: 'flex h-7 shrink-0 items-center',
    body: 'min-w-0 flex-1 py-px leading-7',
  },
  // The arbitrary child selector, not a group variant, so a closed toggle inside an open one still hides.
  toggle: {
    base: 'flex gap-1 [&:not(:first-child)]:mt-3 data-[open=false]:[&>[data-toggle-body]>:nth-child(2)]:hidden',
    button: 'flex h-7 shrink-0 items-center',
    body: 'min-w-0 flex-1',
    title: 'leading-7',
    content: '[&>:first-child]:mt-1',
  },
  embedBlock: {
    base: 'my-3 select-none',
    focus: 'rounded-lg ring-2 ring-ring ring-offset-2 ring-offset-background',
  },
  // Other people's carets and selections. Lexical sets each person's color as `--lexical-cursor-color`.
  collaboration: {
    cursor: 'canvas-cursor',
    cursorName: 'canvas-cursor-name',
    selection: 'canvas-selection',
    selectionBg: 'canvas-selection-bg',
  },
};

// CHECK_LIST comes before UNORDERED_LIST, or `- [ ] ` would read as a bullet holding "[ ]".
const blockTransformers: Transformer[] = [
  HEADING,
  QUOTE,
  CODE,
  HR,
  CHECK_LIST,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_STAR,
  ITALIC_STAR,
  STRIKETHROUGH,
  INLINE_CODE,
  LINK,
];

function createColumnsTransformer(
  transformers: () => Transformer[]
): ElementTransformer {
  return {
    dependencies: [LayoutContainerNode, LayoutItemNode],
    type: 'element',
    export: (node) => {
      if (!$isLayoutContainerNode(node)) return null;
      return node
        .getChildren()
        .filter($isLayoutItemNode)
        .map((cell) => $convertToMarkdownString(transformers(), cell).trim())
        .filter(Boolean)
        .join('\n\n');
    },
    regExp: /(?!)/,
    replace: () => false,
  };
}

const DISPLAY_MENTION: TextMatchTransformer = {
  dependencies: [MentionNode],
  type: 'text-match',
  export: (node) => ($isMentionNode(node) ? node.getTextContent() : null),
  importRegExp: /(?!)/,
  regExp: /(?!)/,
  replace: () => {},
};

function createMessageEmbedTransformer(
  resolveMessageUrl?: (messageId: string) => string | null
): ElementTransformer {
  return {
    dependencies: [MessageEmbedNode],
    type: 'element',
    export: (node) => {
      if (!$isMessageEmbedNode(node)) return null;
      const url = resolveMessageUrl?.(node.getMessageId()) ?? null;
      return url ? `[Embedded message](${url})` : 'Embedded message';
    },
    regExp: /(?!)/,
    replace: () => false,
  };
}

function transformersWith(names: ReadonlyMap<string, string>) {
  // CALLOUT comes before QUOTE, or `> 💡 Note` would read as a quote.
  const inline = [
    CALLOUT,
    ...blockTransformers,
    createMentionTransformer(names),
  ];
  const all: Transformer[] = [
    createToggleTransformer(() => all),
    createColumnsTransformer(() => all),
    ...inline,
    createTableTransformer(inline),
  ];
  return all;
}

function userExportTransformers(
  resolveMessageUrl?: (messageId: string) => string | null
) {
  const inline = [CALLOUT, ...blockTransformers, DISPLAY_MENTION];
  const all: Transformer[] = [
    createToggleTransformer(() => all),
    createColumnsTransformer(() => all),
    createMessageEmbedTransformer(resolveMessageUrl),
    ...inline,
    createTableTransformer(inline),
  ];
  return all;
}

const exportTransformers = transformersWith(new Map());

/** The canvas as Markdown, which search and AI read. A mention is `<@userId>`, as in a message. */
export function canvasMarkdownOf(editor: LexicalEditor) {
  return editor.read(() => $convertToMarkdownString(exportTransformers));
}

/** Distinct message IDs embedded in the editor, for resolving export permalinks. */
export function canvasEmbeddedMessageIdsOf(editor: LexicalEditor): string[] {
  return editor.read(() => [
    ...new Set(
      $nodesOfType(MessageEmbedNode).map((node) => node.getMessageId())
    ),
  ]);
}

/** User-facing Markdown export: mentions render as `@Name`, columns separate with blank lines, and embeds become links. */
export function canvasExportMarkdownOf(
  editor: LexicalEditor,
  options?: { resolveMessageUrl?: (messageId: string) => string | null }
) {
  const transformers = userExportTransformers(options?.resolveMessageUrl);
  return editor.read(() => $convertToMarkdownString(transformers));
}

export type CanvasContent = {
  /** The saved editor state. Wins over `markdown` when both are set. */
  snapshotJson: Record<string, unknown> | null;
  markdown: string;
};

function initialStateOf(
  { snapshotJson, markdown }: CanvasContent,
  names: ReadonlyMap<string, string>
) {
  if (snapshotJson) return JSON.stringify(snapshotJson);
  if (!markdown) return undefined;
  return () => $seedCanvasFromMarkdown(markdown, names);
}

/** The Markdown parse the live document is seeded with, when it has no saved editor state. */
export function $seedCanvasFromMarkdown(
  markdown: string,
  names: ReadonlyMap<string, string>
) {
  $convertFromMarkdownString(markdown, transformersWith(names));
}

/** True while the document holds nothing but one empty line, as a new canvas does. */
export function $isEmptyCanvas() {
  const children = $getRoot().getChildren();
  if (children.length > 1) return false;
  const [first] = children;
  return !first || ($isParagraphNode(first) && first.isEmpty());
}

/**
 * Puts the caret on a new first line, as Enter in the title does. A document that already opens with an empty
 * line reuses it, so pressing Enter twice does not stack blank lines.
 */
export function $selectNewFirstLine() {
  const root = $getRoot();
  const first = root.getFirstChild();
  if ($isParagraphNode(first) && first.isEmpty()) {
    first.select();
    return;
  }
  const line = $createParagraphNode();
  if (first) first.insertBefore(line);
  else root.append(line);
  line.select();
}

/**
 * Replaces the document with a saved editor state as one ordinary edit, so a live editor sends it to everyone
 * on the canvas and each person can still undo it. Call inside `editor.update()`.
 */
export function $replaceCanvasContent(snapshotJson: Record<string, unknown>) {
  const { root } = snapshotJson as unknown as SerializedEditorState;
  const next = $getRoot().clear();
  next.append(...root.children.map((child) => $parseSerializedNode(child)));
  if (next.isEmpty()) next.append($createParagraphNode());
}

/**
 * Stable per canvas: the editor is built from it once, so create it once per opened canvas.
 * `names` labels the mentions in Markdown that has no saved editor state yet.
 * A `collaborative` editor starts empty, since the live document fills it, and leaves undo to Yjs,
 * which undoes only the caller's own edits.
 */
export function createCanvasExtension(
  { snapshotJson, markdown }: CanvasContent,
  names: ReadonlyMap<string, string> = new Map(),
  { collaborative = false, writeHeadingDomIds = true } = {}
) {
  return defineExtension({
    name: '@conduit/canvas',
    namespace: 'canvas',
    theme: canvasTheme,
    nodes: [
      MentionNode,
      CodeBlockNode,
      {
        replace: CodeNode,
        with: (node: CodeNode) => new CodeBlockNode(node.getLanguage()),
        withKlass: CodeBlockNode,
      },
      LayoutContainerNode,
      LayoutItemNode,
      MessageEmbedNode,
      CalloutNode,
      ToggleNode,
      ToggleTitleNode,
      ToggleContentNode,
    ],
    register: (editor) => {
      // Committed heading keys let the transform distinguish newly created or pasted headings from loaded ones.
      const knownKeys = new Set<NodeKey>(
        editor
          .getEditorState()
          .read(() => $nodesOfType(HeadingNode).map((node) => node.getKey()))
      );
      const unregisterTransform = editor.registerNodeTransform(
        HeadingNode,
        (node) => {
          if (
            !editor.isEditable() ||
            $hasUpdateTag(COLLABORATION_TAG) ||
            $hasUpdateTag(HISTORY_MERGE_TAG) ||
            $hasUpdateTag(HISTORIC_TAG)
          ) {
            return;
          }
          const key = node.getKey();
          if (knownKeys.has(key)) return;
          knownKeys.add(key);

          const current = $getHeadingAnchorId(node);
          const used = new Set<string>();
          for (const other of $nodesOfType(HeadingNode)) {
            if (other.getKey() === key) continue;
            const otherId = $getHeadingAnchorId(other);
            if (otherId) used.add(otherId);
          }

          const isPaste = $hasUpdateTag(PASTE_TAG);
          const isDuplicate = Boolean(current) && used.has(current!);
          if (isPaste || !current || isDuplicate) {
            if (current) used.add(current);
            $setHeadingAnchorId(node, createHeadingAnchorId(used));
          }
        }
      );
      const unregisterUpdate = editor.registerUpdateListener(
        ({ editorState }) => {
          editorState.read(() => {
            knownKeys.clear();
            for (const node of $nodesOfType(HeadingNode)) {
              knownKeys.add(node.getKey());
            }
          });
        }
      );
      const unregisterMutation = writeHeadingDomIds
        ? editor.registerMutationListener(HeadingNode, (mutations) => {
            editor.read(() => {
              for (const [key, mutation] of mutations) {
                if (mutation === 'destroyed') continue;
                const element = editor.getElementByKey(key);
                if (!element) continue;
                const node = $getNodeByKey(key);
                const id = $isHeadingNode(node)
                  ? $getHeadingAnchorId(node)
                  : null;
                if (id) {
                  element.id = id;
                } else {
                  element.removeAttribute('id');
                }
              }
            });
          })
        : () => {};
      return () => {
        unregisterTransform();
        unregisterUpdate();
        unregisterMutation();
      };
    },
    onError: (error) => {
      throw error;
    },
    $initialEditorState: collaborative
      ? null
      : initialStateOf({ snapshotJson, markdown }, names),
    dependencies: [
      RichTextExtension,
      ...(collaborative ? [] : [HistoryExtension]),
      ListExtension,
      CheckListExtension,
      LinkExtension,
      AutoLinkExtension,
      MarkExtension,
      CodeExtension,
      configExtension(TableExtension, {
        hasCellMerge: false,
        hasCellBackgroundColor: false,
        hasNestedTables: false,
        hasHorizontalScroll: true,
      }),
      HorizontalRuleExtension,
      TabIndentationExtension,
      EmojisExtension,
      configExtension(MarkdownShortcutsExtension, {
        transformers: blockTransformers,
      }),
    ],
  });
}

/**
 * Parses Markdown into the editor state a new canvas is saved with, off screen, so its first version holds real
 * editor content before anyone opens it. `markdown` is the parse read back, as the editor would save it.
 */
export function canvasSnapshotOf(markdown: string) {
  const editor = buildEditorFromExtensions(
    createCanvasExtension({ snapshotJson: null, markdown })
  );
  try {
    // Reading flushes the pending seed first, so the state is the parsed draft and not the empty start.
    const markdown = canvasMarkdownOf(editor);
    const snapshotJson = editor.getEditorState().toJSON();
    return {
      snapshotJson: snapshotJson as unknown as Record<string, unknown>,
      markdown,
    };
  } finally {
    editor.dispose();
  }
}
