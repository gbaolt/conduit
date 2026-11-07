import type { Root, RootContent, Text } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';

const MENTION = /<@([\w-]+)>/g;

function mention(target: string): Text {
  return {
    type: 'text',
    value: `@${target}`,
    data: { hName: 'span', hProperties: { dataMention: target } },
  } as Text;
}

function split(value: string): RootContent[] {
  const parts: RootContent[] = [];
  let last = 0;

  for (const match of value.matchAll(MENTION)) {
    const [text, target = ''] = match;
    if (match.index > last) {
      parts.push({ type: 'text', value: value.slice(last, match.index) });
    }
    parts.push(mention(target));
    last = match.index + text.length;
  }
  if (last < value.length) {
    parts.push({ type: 'text', value: value.slice(last) });
  }
  return parts;
}

/**
 * Turns `<@userId>`, `<@channel>`, and `<@here>` in text into a `span[data-mention]`.
 * Code is not text in Markdown's tree, so a mention inside code stays as typed.
 */
export function remarkMentions() {
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('<@')) return;
      const parts = split(node.value);
      if (parts.length === 1 && parts[0]?.type === 'text') return;
      parent.children.splice(index, 1, ...(parts as typeof parent.children));
      return [SKIP, index + parts.length];
    });
  };
}
