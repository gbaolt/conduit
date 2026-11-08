import type { TextMatchTransformer } from '@lexical/markdown';

import {
  $createMentionNode,
  $isMentionNode,
  MentionNode,
} from '@/components/editor/nodes/mention-node';

/** `<@userId>`, `<@channel>`, and `<@here>`: the form the server stores and `parseMentions` reads. */
export function createMentionTransformer(
  names: ReadonlyMap<string, string>
): TextMatchTransformer {
  return {
    dependencies: [MentionNode],
    type: 'text-match',
    export: (node) => ($isMentionNode(node) ? `<@${node.getUserId()}>` : null),
    importRegExp: /<@([\w-]+)>/,
    regExp: /<@([\w-]+)>$/,
    replace: (textNode, match) => {
      const id = match[1] ?? '';
      const name =
        id === 'channel' || id === 'here'
          ? id
          : (names.get(id) ?? 'unknown member');
      textNode.replace($createMentionNode(name, id));
    },
  };
}
