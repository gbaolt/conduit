import {
  $convertToMarkdownString,
  type ElementTransformer,
  type Transformer,
} from '@lexical/markdown';

import {
  $isToggleContentNode,
  $isToggleNode,
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
    export: (node) => {
      if (!$isToggleNode(node)) return null;
      const [title, content] = node.getChildren();
      const body = $isToggleContentNode(content)
        ? $convertToMarkdownString(transformers(), content)
        : '';
      return `<details>\n<summary>${title?.getTextContent() ?? ''}</summary>\n\n${body}\n\n</details>`;
    },
    regExp: /(?!)/,
    replace: () => false,
    type: 'element',
  };
}
