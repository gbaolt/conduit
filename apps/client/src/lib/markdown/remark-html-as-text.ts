import type { Parents, Root } from 'mdast';
import { visit } from 'unist-util-visit';

const INLINE_PARENTS = new Set<Parents['type']>([
  'paragraph',
  'heading',
  'emphasis',
  'strong',
  'delete',
  'link',
  'tableCell',
]);

/**
 * Markdown lets HTML through as raw nodes, which the sanitizer then drops, so a pasted tag would vanish.
 * A member who pastes `<img src=x onerror=alert(1)>` should see those characters, so they become text.
 */
export function remarkHtmlAsText() {
  return (tree: Root) => {
    visit(tree, 'html', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const text = { type: 'text' as const, value: node.value };
      parent.children[index] = (
        INLINE_PARENTS.has(parent.type)
          ? text
          : { type: 'paragraph', children: [text] }
      ) as (typeof parent.children)[number];
    });
  };
}
