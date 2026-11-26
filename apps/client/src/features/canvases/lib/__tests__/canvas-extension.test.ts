import {
  buildEditorFromExtensions,
  getExtensionDependencyFromEditor,
} from '@lexical/extension';
import {
  createEmptyHistoryState,
  HistoryExtension,
  registerHistory,
} from '@lexical/history';
import { $isListItemNode, $isListNode } from '@lexical/list';
import {
  $createHeadingNode,
  HeadingNode,
  type SerializedHeadingNode,
} from '@lexical/rich-text';
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  $parseSerializedNode,
  COLLABORATION_TAG,
  HISTORY_PUSH_TAG,
  type ParagraphNode,
  PASTE_TAG,
  type RangeSelection,
  REDO_COMMAND,
  type TextNode,
  UNDO_COMMAND,
} from 'lexical';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { CalloutNode } from '@/components/editor/nodes/callout-node';
import { MentionNode } from '@/components/editor/nodes/mention-node';
import {
  $createToggleNode,
  $isToggleContentNode,
  type ToggleContentNode,
  ToggleNode,
  ToggleTitleNode,
} from '@/components/editor/nodes/toggle-node';
import { matchesPickerQuery } from '@/components/editor/utils/picker-query';

import {
  $replaceCanvasContent,
  $selectNewFirstLine,
  canvasMarkdownOf,
  canvasSnapshotOf,
  createCanvasExtension,
} from '../canvas-extension';
import {
  $getHeadingAnchorId,
  $setHeadingAnchorId,
  assignHeadingAnchors,
  createHeadingAnchorId,
  findHeadingByAnchor,
  isHeadingAnchorId,
} from '../canvas-heading-anchor';

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

describe('toggles', () => {
  function withToggle(open: boolean) {
    const editor = build('');
    editor.update(
      () => {
        const toggle = $createToggleNode().setOpen(open);
        const [title, content] = toggle.getChildren();
        (title as ToggleTitleNode).append($createTextNode('Plan'));
        (content as ToggleContentNode)
          .getFirstChildOrThrow<ParagraphNode>()
          .append($createTextNode('Step one'));
        $getRoot().clear().append(toggle);
      },
      { discrete: true }
    );
    return editor;
  }

  it('writes the title and folded text as a details block', () => {
    const editor = withToggle(true);
    expect(canvasMarkdownOf(editor)).toBe(
      '<details>\n<summary>Plan</summary>\n\nStep one\n\n</details>'
    );
    editor.dispose();
  });

  it('keeps the title formatting in the summary', () => {
    const editor = withToggle(true);
    editor.update(
      () => {
        const [title] = $nodesOfType(ToggleTitleNode);
        title?.getFirstChildOrThrow<TextNode>().toggleFormat('bold');
      },
      { discrete: true }
    );
    expect(canvasMarkdownOf(editor)).toContain('<summary>**Plan**</summary>');
    editor.dispose();
  });

  it('keeps a closed toggle closed in the saved state', () => {
    const editor = withToggle(false);
    const reopened = build('');
    reopened.setEditorState(
      reopened.parseEditorState(
        JSON.stringify(editor.getEditorState().toJSON())
      )
    );
    expect(
      reopened.read(() => $nodesOfType(ToggleNode).map((t) => t.getOpen()))
    ).toEqual([false]);
    editor.dispose();
    reopened.dispose();
  });

  it.each([
    [true, 'starts the content'],
    [false, 'starts a line after the toggle'],
  ])('Enter at the end of the title when open is %s %s', (open) => {
    const editor = withToggle(open);
    editor.update(
      () => {
        const [title] = $nodesOfType(ToggleTitleNode);
        title?.selectEnd();
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertParagraph();
      },
      { discrete: true }
    );
    editor.read(() => {
      const anchor = ($getSelection() as RangeSelection).anchor.getNode();
      expect($isToggleContentNode(anchor.getParent())).toBe(open);
    });
    editor.dispose();
  });
});

describe('heading anchor IDs', () => {
  const legacySnapshot = {
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [
        {
          type: 'heading',
          tag: 'h1',
          version: 1,
          direction: null,
          format: '',
          indent: 0,
          children: [
            {
              type: 'text',
              text: 'Legacy Plan',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  };

  it('loads legacy JSON twice with no mutation and a stable legacy slug', () => {
    const first = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson: legacySnapshot, markdown: '' })
    );
    const second = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson: legacySnapshot, markdown: '' })
    );

    const readHeadings = (editor: ReturnType<typeof build>) =>
      editor.read(() =>
        assignHeadingAnchors(
          $nodesOfType(HeadingNode).map((node) => ({
            text: node.getTextContent(),
            anchorId: $getHeadingAnchorId(node),
          }))
        )
      );

    expect(readHeadings(first)).toEqual([
      {
        text: 'Legacy Plan',
        anchorId: null,
        anchor: 'legacy-plan',
        legacyAnchor: 'legacy-plan',
      },
    ]);
    expect(readHeadings(second)).toEqual(readHeadings(first));
    expect(first.read(() => first.getEditorState().toJSON())).toEqual(
      second.read(() => second.getEditorState().toJSON())
    );

    first.dispose();
    second.dispose();
  });

  it('assigns a fresh persisted ID on local creation and keeps it across rename, reload, and undo/redo', () => {
    const editor = build('');
    // HistoryExtension defaults to disabled in Node (typeof window === 'undefined'), so attach history explicitly.
    const unregisterHistory = registerHistory(
      editor,
      createEmptyHistoryState(),
      300
    );
    // Flush InitialStateExtension's pending HISTORY_MERGE_TAG update before local edits.
    editor.read(() => {});
    editor.update(
      () => {
        const h1 = $createHeadingNode('h1').append($createTextNode('Plan'));
        const h2 = $createHeadingNode('h2').append($createTextNode('Plan'));
        $getRoot().clear().append(h1, h2);
      },
      { discrete: true, tag: HISTORY_PUSH_TAG }
    );

    const ids = editor.read(() =>
      $nodesOfType(HeadingNode).map($getHeadingAnchorId)
    );
    expect(ids).toHaveLength(2);
    expect(isHeadingAnchorId(ids[0])).toBe(true);
    expect(isHeadingAnchorId(ids[1])).toBe(true);
    expect(ids[0]).not.toBe(ids[1]);

    // Rename the first heading, then undo and redo — the ID must stay identical throughout.
    editor.update(
      () => {
        const [first] = $nodesOfType(HeadingNode);
        first!.clear().append($createTextNode('Q4 Launch Plan'));
      },
      { discrete: true, tag: HISTORY_PUSH_TAG }
    );
    expect(
      editor.read(() => $getHeadingAnchorId($nodesOfType(HeadingNode)[0]!))
    ).toBe(ids[0]);

    editor.dispatchCommand(UNDO_COMMAND, undefined);
    expect(
      editor.read(() => {
        const [first] = $nodesOfType(HeadingNode);
        return [first!.getTextContent(), $getHeadingAnchorId(first!)];
      })
    ).toEqual(['Plan', ids[0]]);

    editor.dispatchCommand(REDO_COMMAND, undefined);
    expect(
      editor.read(() => {
        const [first] = $nodesOfType(HeadingNode);
        return [first!.getTextContent(), $getHeadingAnchorId(first!)];
      })
    ).toEqual(['Q4 Launch Plan', ids[0]]);

    // Reload from serialized snapshot preserves the IDs.
    const snapshotJson = editor.read(() =>
      editor.getEditorState().toJSON()
    ) as unknown as Record<string, unknown>;
    const reopened = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson, markdown: '' })
    );
    expect(
      reopened.read(() => $nodesOfType(HeadingNode).map($getHeadingAnchorId))
    ).toEqual(ids);

    unregisterHistory();
    editor.dispose();
    reopened.dispose();
  });

  it('always assigns a new ID when pasting an anchored heading, even if its source ID is absent', () => {
    const source = build('');
    source.read(() => {});
    source.update(
      () => {
        const heading = $createHeadingNode('h1').append(
          $createTextNode('Copied Plan')
        );
        $getRoot().clear().append(heading);
      },
      { discrete: true }
    );
    const [sourceId, serialized] = source.read(() => {
      const [heading] = $nodesOfType(HeadingNode);
      return [$getHeadingAnchorId(heading!)!, heading!.exportJSON()] as const;
    });
    source.dispose();

    const destination = build('');
    destination.read(() => {});
    destination.update(
      () => {
        $getRoot().clear().append($parseSerializedNode(serialized));
      },
      { discrete: true, tag: PASTE_TAG }
    );

    const pastedId = destination.read(() =>
      $getHeadingAnchorId($nodesOfType(HeadingNode)[0]!)
    );
    expect(isHeadingAnchorId(pastedId)).toBe(true);
    expect(pastedId).not.toBe(sourceId);
    destination.dispose();
  });

  it('gives two in-memory Yjs peers distinct IDs when both paste the same anchored heading', () => {
    const source = build('');
    source.read(() => {});
    source.update(
      () => {
        $getRoot()
          .clear()
          .append($createHeadingNode('h1').append($createTextNode('Shared')));
      },
      { discrete: true }
    );
    const [sourceId, serialized] = source.read(() => {
      const [heading] = $nodesOfType(HeadingNode);
      return [$getHeadingAnchorId(heading!)!, heading!.exportJSON()] as const;
    });
    source.dispose();

    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const listA = docA.getArray<string>('headings');
    const listB = docB.getArray<string>('headings');

    const peerA = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson: null, markdown: '' }, new Map(), {
        collaborative: true,
      })
    );
    const peerB = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson: null, markdown: '' }, new Map(), {
        collaborative: true,
      })
    );

    // Each peer pastes the same serialized heading locally before syncing.
    const pasteInto = (
      editor: ReturnType<typeof build>,
      list: Y.Array<string>
    ) => {
      editor.update(
        () => {
          $getRoot().append($parseSerializedNode(serialized));
        },
        { discrete: true, tag: PASTE_TAG }
      );
      const pasted = editor.read(() =>
        $nodesOfType(HeadingNode).at(-1)!.exportJSON()
      );
      list.push([JSON.stringify(pasted)]);
    };

    pasteInto(peerA, listA);
    pasteInto(peerB, listB);

    // Exchange Yjs updates and apply remote headings with COLLABORATION_TAG.
    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docA, updateB);
    Y.applyUpdate(docB, updateA);

    const applyMerged = (
      editor: ReturnType<typeof build>,
      list: Y.Array<string>
    ) => {
      editor.update(
        () => {
          const root = $getRoot().clear();
          for (const raw of list.toArray()) {
            root.append(
              $parseSerializedNode(JSON.parse(raw) as SerializedHeadingNode)
            );
          }
        },
        { discrete: true, tag: COLLABORATION_TAG }
      );
    };

    applyMerged(peerA, listA);
    applyMerged(peerB, listB);

    const idsA = peerA.read(() =>
      $nodesOfType(HeadingNode).map($getHeadingAnchorId)
    );
    const idsB = peerB.read(() =>
      $nodesOfType(HeadingNode).map($getHeadingAnchorId)
    );
    expect(idsA).toHaveLength(2);
    expect(idsA).toEqual(idsB);
    expect(idsA[0]).not.toBe(idsA[1]);
    expect(idsA[0]).not.toBe(sourceId);
    expect(idsA[1]).not.toBe(sourceId);

    peerA.dispose();
    peerB.dispose();
  });

  it('keeps legacy slug links resolving after lazy ID assignment on Copy link', () => {
    const editor = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson: legacySnapshot, markdown: '' })
    );
    let assignedId: string | null = null;
    editor.update(
      () => {
        const [heading] = $nodesOfType(HeadingNode);
        assignedId = createHeadingAnchorId();
        $setHeadingAnchorId(heading!, assignedId);
      },
      { discrete: true }
    );

    const headings = editor.read(() =>
      assignHeadingAnchors(
        $nodesOfType(HeadingNode).map((node) => ({
          key: node.getKey(),
          text: node.getTextContent(),
          anchorId: $getHeadingAnchorId(node),
        }))
      )
    );
    expect(findHeadingByAnchor(headings, 'legacy-plan')?.key).toBe(
      headings[0]!.key
    );
    expect(
      findHeadingByAnchor(headings, `legacy-plan--${assignedId}`)?.key
    ).toBe(headings[0]!.key);
    editor.dispose();
  });

  it('keeps legacy heading JSON without an anchorId as null in a read-only editor', () => {
    const editor = buildEditorFromExtensions({
      name: '@conduit/canvas-readonly-test',
      editable: false,
      dependencies: [
        createCanvasExtension({ snapshotJson: legacySnapshot, markdown: '' }),
      ],
    });
    const ids = editor.read(() =>
      $nodesOfType(HeadingNode).map($getHeadingAnchorId)
    );
    expect(ids).toEqual([null]);
    editor.dispose();
  });
});
