import { highlightTerms } from '@conduit/contract';
import type { Root, RootContent, Text } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';

/** Wraps each search term in text in a `mark`. Code, mentions, and emoji keep their own elements. */
export function remarkHighlight(terms: readonly string[]) {
  return () => (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || node.data) return;
      const runs = highlightTerms(node.value, terms);
      if (!runs.some((run) => run.match)) return;
      const parts: RootContent[] = runs.map((run) =>
        run.match
          ? ({
              type: 'text',
              value: run.text,
              data: { hName: 'mark' },
            } as Text)
          : { type: 'text', value: run.text }
      );
      parent.children.splice(index, 1, ...(parts as typeof parent.children));
      return [SKIP, index + parts.length];
    });
  };
}
