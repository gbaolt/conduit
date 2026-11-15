import { MESSAGE_BODY_MAX } from '@conduit/contract';
import { CodeExtension, CodeNode } from '@lexical/code';
import { HistoryExtension } from '@lexical/history';
import { LinkExtension } from '@lexical/link';
import { ListExtension } from '@lexical/list';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_STAR,
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
import { MaxLengthExtension } from '@/components/editor/extensions/max-length-extension';
import { CodeBlockNode } from '@/components/editor/nodes/code-block-node';
import { MentionNode } from '@/components/editor/nodes/mention-node';
import { editorTheme } from '@/components/editor/themes/editor-theme';
import { createTableTransformer } from '@/components/editor/transformers/markdown-table-transformer';

import { createMentionTransformer } from './mention-transformer';

/** The kit's theme sized to match a sent message, so the composer shows what the log will. */
const composerTheme: EditorThemeClasses = {
  ...editorTheme,
  paragraph: 'text-sm leading-[23px] [&:not(:first-child)]:mt-2',
  heading: {
    h1: 'text-[21px] leading-tight font-medium [&:not(:first-child)]:mt-3',
    h2: 'text-lg leading-tight font-medium [&:not(:first-child)]:mt-3',
    h3: 'text-base leading-tight font-medium [&:not(:first-child)]:mt-3',
    h4: 'text-sm font-medium [&:not(:first-child)]:mt-3',
    h5: 'text-sm font-medium [&:not(:first-child)]:mt-3',
    h6: 'text-sm font-medium [&:not(:first-child)]:mt-3',
  },
  quote:
    'border-border text-muted-foreground border-l-2 pl-3 text-sm leading-[23px] [&:not(:first-child)]:mt-2',
  list: {
    ...editorTheme.list,
    ul: 'm-0 list-outside list-disc p-0 [&:not(:first-child)]:mt-2',
    ol: 'm-0 list-outside list-decimal p-0 [&:not(:first-child)]:mt-2',
    listitem:
      'ml-6 pl-1 text-sm leading-[23px] [&+li]:mt-1 marker:text-muted-foreground',
    nested: { listitem: 'list-none' },
  },
};

/** What Markdown can hold and the renderer shows, so typing `- ` or `# ` looks the same before and after send. */
const blockTransformers: Transformer[] = [
  HEADING,
  BOLD_STAR,
  ITALIC_STAR,
  STRIKETHROUGH,
  INLINE_CODE,
  LINK,
  UNORDERED_LIST,
  ORDERED_LIST,
  QUOTE,
  CODE,
];

/** A table's cells read and write their Markdown with the same transformers, mentions included. */
function withTable(transformers: Transformer[]) {
  return [...transformers, createTableTransformer(transformers)];
}

const exportTransformers = withTable([
  ...blockTransformers,
  createMentionTransformer(new Map()),
]);

/** The Markdown to send. A list the member left open on an empty item would otherwise end in a bare bullet. */
export function markdownOf(editor: LexicalEditor) {
  return editor
    .read(() => $convertToMarkdownString(exportTransformers))
    .replace(/(?:\n[ \t]*(?:[-*+]|\d+\.)[ \t]*)+$/, '');
}

/**
 * Stable per `initialMarkdown`: the editor is rebuilt when it changes, so create it once per composer.
 * `names` labels the mentions in `initialMarkdown`.
 */
export function createComposerExtension(
  initialMarkdown: string,
  names: ReadonlyMap<string, string> = new Map()
) {
  return defineExtension({
    name: '@conduit/composer',
    namespace: 'composer',
    theme: composerTheme,
    nodes: [
      MentionNode,
      CodeBlockNode,
      {
        replace: CodeNode,
        with: (node: CodeNode) => new CodeBlockNode(node.getLanguage()),
        withKlass: CodeBlockNode,
      },
    ],
    onError: (error) => {
      throw error;
    },
    $initialEditorState: initialMarkdown
      ? () => {
          $convertFromMarkdownString(
            initialMarkdown,
            withTable([...blockTransformers, createMentionTransformer(names)])
          );
        }
      : undefined,
    dependencies: [
      RichTextExtension,
      HistoryExtension,
      ListExtension,
      LinkExtension,
      AutoLinkExtension,
      CodeExtension,
      configExtension(TableExtension, {
        hasCellMerge: false,
        hasCellBackgroundColor: false,
        hasNestedTables: false,
        hasHorizontalScroll: true,
      }),
      EmojisExtension,
      configExtension(MarkdownShortcutsExtension, {
        // A row typed so far already looks like a whole row, so typing never starts a table. Pasting one does.
        transformers: blockTransformers,
      }),
      configExtension(MaxLengthExtension, { maxLength: MESSAGE_BODY_MAX }),
    ],
  });
}
