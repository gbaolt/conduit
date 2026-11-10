import type { Root } from 'mdast';
import { describe, expect, it } from 'vitest';

import { remarkTwemoji } from '../remark-twemoji';

function run(children: Root['children']) {
  const tree: Root = { type: 'root', children };
  remarkTwemoji()(tree);
  return tree.children;
}

describe('remarkTwemoji', () => {
  it('marks each emoji and keeps the text around it', () => {
    const [paragraph] = run([
      { type: 'paragraph', children: [{ type: 'text', value: 'hi 🇻🇳 ok 👍🏽' }] },
    ]);
    const parts =
      paragraph?.type === 'paragraph'
        ? paragraph.children.map((node) => [
            'value' in node ? node.value : null,
            Boolean(node.data),
          ])
        : [];
    expect(parts).toEqual([
      ['hi ', false],
      ['🇻🇳', true],
      [' ok ', false],
      ['👍🏽', true],
    ]);
  });

  it('leaves code as typed', () => {
    const tree = run([{ type: 'code', value: '🚀' }]);
    expect(tree).toEqual([{ type: 'code', value: '🚀' }]);
  });
});
