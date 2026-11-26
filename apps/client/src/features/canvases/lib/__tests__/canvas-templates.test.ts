import { buildEditorFromExtensions } from '@lexical/extension';
import { $isListNode } from '@lexical/list';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isTableNode } from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ParagraphNode,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import {
  $isEmptyCanvas,
  $seedCanvasFromMarkdown,
  createCanvasExtension,
} from '../canvas-extension';
import { CANVAS_TEMPLATES } from '../canvas-templates';

function emptyCanvas() {
  const editor = buildEditorFromExtensions(
    createCanvasExtension({ snapshotJson: null, markdown: '' })
  );
  editor.update(
    () => {
      if ($getRoot().isEmpty()) $getRoot().append($createParagraphNode());
    },
    { discrete: true }
  );
  return editor;
}

describe('$isEmptyCanvas', () => {
  it('holds for a new canvas and stops once someone types', () => {
    const editor = emptyCanvas();
    expect(editor.read($isEmptyCanvas)).toBe(true);
    editor.update(
      () =>
        $getRoot()
          .getFirstChildOrThrow<ParagraphNode>()
          .append($createTextNode('Hi')),
      { discrete: true }
    );
    expect(editor.read($isEmptyCanvas)).toBe(false);
    editor.dispose();
  });
});

describe.each(CANVAS_TEMPLATES)('the $label template', (template) => {
  it('replaces the empty line with headings and lists', () => {
    const editor = emptyCanvas();
    editor.update(() => $seedCanvasFromMarkdown(template.markdown, new Map()), {
      discrete: true,
    });
    const blocks = editor.read(() => $getRoot().getChildren());
    editor.read(() => {
      expect($isHeadingNode(blocks[0])).toBe(true);
      expect(blocks.some($isListNode)).toBe(true);
      expect($isEmptyCanvas()).toBe(false);
      // A list or table line the parser missed would stay as its raw marker.
      const raw = blocks
        .map((block) => block.getTextContent().trim())
        .filter((text) => /^(-|\d+\.|\[ ?\]|\|)/.test(text));
      expect(raw).toEqual([]);
    });
    editor.dispose();
  });
});

it('gives the project brief a timeline table', () => {
  const editor = emptyCanvas();
  const brief = CANVAS_TEMPLATES.find(({ id }) => id === 'project-brief')!;
  editor.update(() => $seedCanvasFromMarkdown(brief.markdown, new Map()), {
    discrete: true,
  });
  expect(editor.read(() => $getRoot().getChildren().some($isTableNode))).toBe(
    true
  );
  editor.dispose();
});
