import { CodeExtension, CodeNode } from '@lexical/code';
import {
  HorizontalRuleExtension,
  TabIndentationExtension,
} from '@lexical/extension';
import { HistoryExtension } from '@lexical/history';
import { LinkExtension } from '@lexical/link';
import { CheckListExtension, ListExtension } from '@lexical/list';
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
  configExtension,
  defineExtension,
  type EditorThemeClasses,
  type LexicalEditor,
} from 'lexical';

import { AutoLinkExtension } from '@/components/editor/extensions/auto-link-extension';
import { EmojisExtension } from '@/components/editor/extensions/emojis-extension';
import { MarkdownShortcutsExtension } from '@/components/editor/extensions/markdown-shortcuts-extension';
import { CodeBlockNode } from '@/components/editor/nodes/code-block-node';
import { LayoutContainerNode } from '@/components/editor/nodes/layout-container-node';
import { LayoutItemNode } from '@/components/editor/nodes/layout-item-node';
import { MentionNode } from '@/components/editor/nodes/mention-node';
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
  return () => $convertFromMarkdownString(markdown, transformersWith(names));
}

/**
 * Stable per canvas: the editor is built from it once, so create it once per opened canvas.
 * `names` labels the mentions in Markdown that has no saved editor state yet.
 */
export function createCanvasExtension(
  { snapshotJson, markdown }: CanvasContent,
  names: ReadonlyMap<string, string> = new Map()
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
    ],
    onError: (error) => {
      throw error;
    },
    $initialEditorState: initialStateOf({ snapshotJson, markdown }, names),
    dependencies: [
      RichTextExtension,
      HistoryExtension,
      ListExtension,
      CheckListExtension,
      LinkExtension,
      AutoLinkExtension,
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
