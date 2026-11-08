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
import { MarkdownShortcutsExtension } from '@/components/editor/extensions/markdown-shortcuts-extension';
import { MaxLengthExtension } from '@/components/editor/extensions/max-length-extension';
import { MentionNode } from '@/components/editor/nodes/mention-node';
import { editorTheme } from '@/components/editor/themes/editor-theme';

import { createMentionTransformer } from './mention-transformer';

/** The kit's theme sized for a chat row: body text, 20 px list indent, and a code block with no gutter. */
const composerTheme: EditorThemeClasses = {
  ...editorTheme,
  paragraph: 'text-sm leading-[22px] [&:not(:first-child)]:mt-1.5',
  quote: 'border-border border-l-[3px] pl-3 text-sm leading-[22px]',
  list: {
    ...editorTheme.list,
    ul: 'm-0 list-outside list-disc p-0',
    ol: 'm-0 list-outside list-decimal p-0',
    listitem: 'ml-5 text-sm leading-[22px]',
    nested: { listitem: 'list-none' },
  },
  code: 'bg-muted border-border my-1.5 block overflow-x-auto rounded-md border px-3 py-2 font-mono text-[13px] leading-5',
};

/** What Markdown can hold and the renderer shows. Headings are left out, since a chat row never shows one. */
const composerTransformers: Transformer[] = [
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
      configExtension(MarkdownShortcutsExtension, {
        transformers: composerTransformers,
      }),
      configExtension(MaxLengthExtension, { maxLength: MESSAGE_BODY_MAX }),
    ],
  });
}
