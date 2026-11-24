import { buildEditorFromExtensions } from '@lexical/extension';
import { $isListItemNode, $isListNode } from '@lexical/list';
import { $getRoot, $nodesOfType } from 'lexical';
import { describe, expect, it } from 'vitest';

import { MentionNode } from '@/components/editor/nodes/mention-node';
import { matchesPickerQuery } from '@/components/editor/utils/picker-query';

import { canvasMarkdownOf, createCanvasExtension } from './canvas-extension';

function build(markdown: string, names?: ReadonlyMap<string, string>) {
  return buildEditorFromExtensions(
    createCanvasExtension({ snapshotJson: null, markdown }, names)
  );
}

function roundTrip(markdown: string) {
  const editor = build(markdown);
  const result = canvasMarkdownOf(editor);
  editor.dispose();
  return result;
}

describe('/ menu search', () => {
  const checklist = { title: 'Check List', keywords: ['check list', 'todo'] };

  it.each(['[', '(', '*', '+', '?', '\\', '.*'])(
    'treats %s as text instead of throwing',
    (query) => {
      expect(() => matchesPickerQuery(checklist, query)).not.toThrow();
      expect(matchesPickerQuery(checklist, query)).toBe(false);
    }
  );

  it('matches the title and keywords regardless of case', () => {
    expect(matchesPickerQuery(checklist, 'CHECK')).toBe(true);
    expect(matchesPickerQuery(checklist, 'todo')).toBe(true);
    expect(matchesPickerQuery({ title: 'a.b', keywords: [] }, '.')).toBe(true);
  });
});

describe('canvas Markdown', () => {
  it.each([
    ['headings', '# One\n\n## Two\n\n### Three'],
    ['a checklist', '- [ ] open\n- [x] done'],
    ['a bulleted list', '- one\n- two'],
    ['a numbered list', '1. one\n2. two'],
    ['a quote', '> quoted'],
    ['fenced code', '```ts\nconst a = 1;\n```'],
    ['a divider', 'above\n\n***\n\nbelow'],
    ['a table', '| a | b |\n| --- | --- |\n| 1 | 2 |'],
    ['inline formatting', '**bold** *italic* ~~gone~~ `code`'],
  ])('keeps %s', (_name, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('reads a checklist as checkable items with their state', () => {
    const editor = build('- [ ] open\n- [x] done');
    const items = editor.read(() => {
      const list = $getRoot().getFirstChild();
      if (!$isListNode(list)) return null;
      return {
        type: list.getListType(),
        checked: list
          .getChildren()
          .map((item) => ($isListItemNode(item) ? item.getChecked() : null)),
      };
    });
    editor.dispose();
    expect(items).toEqual({ type: 'check', checked: [false, true] });
  });

  it('stores a mention as the member id and shows their name', () => {
    const editor = build('Ask <@u1> today', new Map([['u1', 'Linh']]));
    const mentions = editor.read(() =>
      $nodesOfType(MentionNode).map((node) => ({
        id: node.getUserId(),
        text: node.getTextContent(),
      }))
    );
    expect(mentions).toEqual([{ id: 'u1', text: '@Linh' }]);
    expect(canvasMarkdownOf(editor)).toBe('Ask <@u1> today');
    editor.dispose();
  });

  it('restores a saved editor state over the Markdown', () => {
    const source = build('# Saved');
    // `read` flushes the pending initial update first.
    const snapshotJson = source.read(() =>
      source.getEditorState().toJSON()
    ) as unknown as Record<string, unknown>;
    source.dispose();

    const editor = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson, markdown: 'ignored' })
    );
    expect(canvasMarkdownOf(editor)).toBe('# Saved');
    editor.dispose();
  });
});
