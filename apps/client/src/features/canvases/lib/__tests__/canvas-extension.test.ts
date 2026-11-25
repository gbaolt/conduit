import {
  buildEditorFromExtensions,
  getExtensionDependencyFromEditor,
} from '@lexical/extension';
import { HistoryExtension } from '@lexical/history';
import { $isListItemNode, $isListNode } from '@lexical/list';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import { CalloutNode } from '@/components/editor/nodes/callout-node';
import { MentionNode } from '@/components/editor/nodes/mention-node';
import { matchesPickerQuery } from '@/components/editor/utils/picker-query';

import {
  $replaceCanvasContent,
  $selectNewFirstLine,
  canvasMarkdownOf,
  canvasSnapshotOf,
  createCanvasExtension,
} from '../canvas-extension';

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

describe('collaborative canvas', () => {
  it('starts empty and leaves undo to Yjs', () => {
    const content = { snapshotJson: null, markdown: '# Saved' };
    const solo = buildEditorFromExtensions(createCanvasExtension(content));
    const live = buildEditorFromExtensions(
      createCanvasExtension(content, new Map(), { collaborative: true })
    );

    expect(live.read(() => $getRoot().isEmpty())).toBe(true);
    expect(() =>
      getExtensionDependencyFromEditor(solo, HistoryExtension)
    ).not.toThrow();
    expect(() =>
      getExtensionDependencyFromEditor(live, HistoryExtension)
    ).toThrow();
    solo.dispose();
    live.dispose();
  });
});

describe('restoring a version', () => {
  it('replaces the whole document with the saved one', () => {
    const v1 = '# v1\n\n- [ ] ship';
    const saved = build(v1);
    // Reading first applies the initial content, which the editor otherwise defers.
    const snapshotJson = saved.read(() =>
      saved.getEditorState().toJSON()
    ) as unknown as Record<string, unknown>;
    const live = build('# v2\n\nmore text');

    live.update(() => $replaceCanvasContent(snapshotJson), { discrete: true });

    expect(canvasMarkdownOf(live)).toBe(v1);
    saved.dispose();
    live.dispose();
  });

  it('leaves an empty paragraph for an empty version', () => {
    const live = build('text');
    live.update(() => $replaceCanvasContent({ root: { children: [] } }), {
      discrete: true,
    });
    expect(live.read(() => $getRoot().getChildrenSize())).toBe(1);
    live.dispose();
  });
});

describe('canvasSnapshotOf', () => {
  it('turns an AI draft into an editor state that reopens as the same draft', () => {
    const draft = [
      '## Scope',
      '',
      'Author and date. [1](/channels/c1?thread=t&message=m)',
      '',
      '## Action items',
      '',
      '- [ ] Ship it',
    ].join('\n');

    const { snapshotJson, markdown } = canvasSnapshotOf(draft);

    expect(markdown).toBe(draft);
    const reopened = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson, markdown: '' })
    );
    expect(canvasMarkdownOf(reopened)).toBe(draft);
    reopened.dispose();
  });
});

describe('$selectNewFirstLine', () => {
  it('opens an empty first line above the content and puts the caret in it', () => {
    const editor = build('Intro\n\n## Notes');
    editor.update(() => $selectNewFirstLine(), { discrete: true });
    editor.read(() => {
      const first = $getRoot().getFirstChildOrThrow();
      expect(first.getTextContent()).toBe('');
      expect($getRoot().getChildrenSize()).toBe(3);
      const selection = $getSelection();
      expect(
        $isRangeSelection(selection) && selection.anchor.getNode().is(first)
      ).toBe(true);
    });
    editor.dispose();
  });

  it('reuses an empty first line instead of stacking another', () => {
    const editor = build('Intro');
    editor.update(() => $selectNewFirstLine(), { discrete: true });
    editor.update(() => $selectNewFirstLine(), { discrete: true });
    expect(editor.read(() => $getRoot().getChildrenSize())).toBe(2);
    editor.dispose();
  });
});

describe('callouts', () => {
  it('reads `> 💡 text` as a callout and writes it back the same way', () => {
    expect(roundTrip('> 💡 Ship it on Friday')).toBe('> 💡 Ship it on Friday');
    const editor = build('> ⚠️ Mind the gap');
    editor.read(() => {
      const [callout] = $nodesOfType(CalloutNode);
      expect(callout?.getEmoji()).toBe('⚠️');
      expect(callout?.getTextContent()).toBe('Mind the gap');
    });
    editor.dispose();
  });

  it('keeps every line of a callout in one callout, even a line led by an emoji', () => {
    const markdown = '> 💡 Line one\n> 🚀 Line two\n> Line three';
    expect(roundTrip(markdown)).toBe(markdown);
    const editor = build(`${markdown}\n\n> ⚠️ Second callout`);
    editor.read(() => {
      expect($nodesOfType(CalloutNode).map((c) => c.getTextContent())).toEqual([
        'Line one\n🚀 Line two\nLine three',
        'Second callout',
      ]);
    });
    editor.dispose();
  });

  it('reads an empty callout whose trailing space was trimmed', () => {
    const editor = build('> 💡');
    expect(editor.read(() => $nodesOfType(CalloutNode))).toHaveLength(1);
    editor.dispose();
  });

  it('leaves a quote without a leading emoji as a quote', () => {
    const editor = build('> Just a quote');
    expect(editor.read(() => $nodesOfType(CalloutNode))).toHaveLength(0);
    editor.dispose();
  });

  it('keeps its emoji and color in the saved state', () => {
    const editor = build('> 💡 Note');
    editor.update(
      () => {
        const [callout] = $nodesOfType(CalloutNode);
        callout?.setEmoji('🚀').setTone('green');
      },
      { discrete: true }
    );
    const reopened = build('');
    reopened.setEditorState(
      reopened.parseEditorState(
        JSON.stringify(editor.getEditorState().toJSON())
      )
    );
    reopened.read(() => {
      const [callout] = $nodesOfType(CalloutNode);
      expect([callout?.getEmoji(), callout?.getTone()]).toEqual([
        '🚀',
        'green',
      ]);
    });
    editor.dispose();
    reopened.dispose();
  });
});
