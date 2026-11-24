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
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  type Transformer,
  UNORDERED_LIST,
} from '@lexical/markdown';
import { RichTextExtension } from '@lexical/rich-text';
import { TableExtension } from '@lexical/table';
import {
  $createParagraphNode,
  $getRoot,
  $parseSerializedNode,
  configExtension,
  defineExtension,
  type EditorThemeClasses,
  type LexicalEditor,
  type SerializedEditorState,
} from 'lexical';

import { AutoLinkExtension } from '@/components/editor/extensions/auto-link-extension';
import { EmojisExtension } from '@/components/editor/extensions/emojis-extension';
import { MarkdownShortcutsExtension } from '@/components/editor/extensions/markdown-shortcuts-extension';
import { CodeBlockNode } from '@/components/editor/nodes/code-block-node';
import { LayoutContainerNode } from '@/components/editor/nodes/layout-container-node';
import { LayoutItemNode } from '@/components/editor/nodes/layout-item-node';
import { MentionNode } from '@/components/editor/nodes/mention-node';
import { MessageEmbedNode } from '@/components/editor/nodes/message-embed-node';
import { editorTheme } from '@/components/editor/themes/editor-theme';
import { HR } from '@/components/editor/transformers/markdown-hr-transformer';
import { createTableTransformer } from '@/components/editor/transformers/markdown-table-transformer';
import { createMentionTransformer } from '@/features/messages/lib/mention-transformer';

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

function transformersWith(names: ReadonlyMap<string, string>) {
  const inline = [...blockTransformers, createMentionTransformer(names)];
  return [...inline, createTableTransformer(inline)];
}

const exportTransformers = transformersWith(new Map());

/** The canvas as Markdown, which search and AI read. A mention is `<@userId>`, as in a message. */
export function canvasMarkdownOf(editor: LexicalEditor) {
  return editor.read(() => $convertToMarkdownString(exportTransformers));
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
  { collaborative = false } = {}
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
    ],
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
