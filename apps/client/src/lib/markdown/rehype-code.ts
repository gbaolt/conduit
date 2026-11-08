import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';

function textOf(nodes: ElementContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.value;
      return node.type === 'element' ? textOf(node.children) : '';
    })
    .join('');
}

/**
 * Hands a fenced block's language and raw text to the `pre` component as `data-language` and `data-code`,
 * so it can draw a `CodeBlock` without reading the tree. Runs after sanitizing, which would drop both.
 */
export function rehypeCode() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const code = node.tagName === 'pre' ? node.children[0] : undefined;
      if (code?.type !== 'element' || code.tagName !== 'code') return;

      const className = code.properties.className;
      const language = (Array.isArray(className) ? className : [])
        .map(String)
        .find((name) => name.startsWith('language-'))
        ?.slice('language-'.length);

      node.properties.dataLanguage = language;
      node.properties.dataCode = textOf(code.children).replace(/\n$/, '');
    });
  };
}
