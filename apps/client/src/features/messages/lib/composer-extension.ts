import { MESSAGE_BODY_MAX } from '@conduit/contract';
import { CodeExtension } from '@lexical/code';
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
import { MentionNode } from '@/components/editor/nodes/mention-node';
import { editorTheme } from '@/components/editor/themes/editor-theme';

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
  code: 'bg-muted border-border my-1.5 block overflow-x-auto rounded-md border px-3 py-2 font-mono text-[13px] leading-5',
};

/** What Markdown can hold and the renderer shows, so typing `- ` or `# ` looks the same before and after send. */
const composerTransformers: Transformer[] = [
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

const exportTransformers = [
  ...composerTransformers,
  createMentionTransformer(new Map()),
];

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
    nodes: [MentionNode],
    onError: (error) => {
      throw error;
    },
    $initialEditorState: initialMarkdown
      ? () => {
          $convertFromMarkdownString(initialMarkdown, [
            ...composerTransformers,
            createMentionTransformer(names),
          ]);
        }
      : undefined,
    dependencies: [
      RichTextExtension,
      HistoryExtension,
      ListExtension,
      LinkExtension,
      AutoLinkExtension,
      CodeExtension,
      EmojisExtension,
      configExtension(MarkdownShortcutsExtension, {
        transformers: composerTransformers,
      }),
      configExtension(MaxLengthExtension, { maxLength: MESSAGE_BODY_MAX }),
    ],
  });
}
