import { EMOJI_PATTERN } from '@conduit/ui/components/twemoji';
import type { Root, RootContent, Text } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';

const EMOJI = new RegExp(EMOJI_PATTERN, `g${EMOJI_PATTERN.flags}`);

/**
 * Wraps each emoji in text in a `span[data-emoji]`, which the renderer draws with Twemoji.
 * Code is not text in Markdown's tree, so an emoji inside code stays as typed.
 */
export function remarkTwemoji() {
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      // A mention is a text node that already carries its own element.
      if (!parent || index === undefined || node.data) return;
      const parts: RootContent[] = [];
      let last = 0;

      for (const match of node.value.matchAll(EMOJI)) {
        if (match.index > last) {
          parts.push({
            type: 'text',
            value: node.value.slice(last, match.index),
          });
        }
        parts.push({
          type: 'text',
          value: match[0],
          data: { hName: 'span', hProperties: { dataEmoji: '' } },
        } as Text);
        last = match.index + match[0].length;
      }
      if (parts.length === 0) return;
      if (last < node.value.length) {
        parts.push({ type: 'text', value: node.value.slice(last) });
      }
      parent.children.splice(index, 1, ...(parts as typeof parent.children));
      return [SKIP, index + parts.length];
    });
  };
}
