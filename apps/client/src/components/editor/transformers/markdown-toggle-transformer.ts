import {
  $convertToMarkdownString,
  type ElementTransformer,
  type Transformer,
} from '@lexical/markdown';

import {
  $isToggleContentNode,
  $isToggleNode,
  $isToggleTitleNode,
  ToggleContentNode,
  ToggleNode,
  ToggleTitleNode,
} from '@/components/editor/nodes/toggle-node';

/**
 * A toggle reads as an HTML `<details>` block, as GitHub writes one, so search and AI see the folded text.
 * Export only: a Markdown seed has no way to write a toggle yet.
 */
export function createToggleTransformer(
  transformers: () => Transformer[]
): ElementTransformer {
  return {
    dependencies: [ToggleNode, ToggleTitleNode, ToggleContentNode],
    export: (node, exportChildren) => {
      if (!$isToggleNode(node)) return null;
      const [title, content] = node.getChildren();
      const summary = $isToggleTitleNode(title) ? exportChildren(title) : '';
      const body = $isToggleContentNode(content)
        ? $convertToMarkdownString(transformers(), content)
        : '';
      return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
    },
    regExp: /(?!)/,
    replace: () => false,
    type: 'element',
  };
}
