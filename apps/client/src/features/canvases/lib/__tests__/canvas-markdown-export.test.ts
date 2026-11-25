import { buildEditorFromExtensions } from '@lexical/extension';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { describe, expect, it } from 'vitest';

import { $createLayoutContainerNode } from '@/components/editor/nodes/layout-container-node';
import { $createLayoutItemNode } from '@/components/editor/nodes/layout-item-node';
import { $createMessageEmbedNode } from '@/components/editor/nodes/message-embed-node';

import {
  canvasExportMarkdownOf,
  createCanvasExtension,
} from '../canvas-extension';
import { markdownFilenameOf } from '../canvas-markdown-export';

describe('canvas Markdown export filename', () => {
  it('appends .md and sanitizes illegal filename characters', () => {
    expect(markdownFilenameOf('Launch Plan')).toBe('Launch Plan.md');
    expect(markdownFilenameOf('Q4: Launch / Notes?')).toBe(
      'Q4- Launch - Notes.md'
    );
  });

  it('falls back to Untitled and avoids doubling .md', () => {
    expect(markdownFilenameOf('   ')).toBe('Untitled.md');
    expect(markdownFilenameOf('...')).toBe('Untitled.md');
    expect(markdownFilenameOf('README.md')).toBe('README.md');
  });

  it.each([
    ['CON', 'CON-canvas.md'],
    ['con', 'con-canvas.md'],
    ['PRN.md', 'PRN-canvas.md'],
    ['aux', 'aux-canvas.md'],
    ['NUL.txt', 'NUL.txt-canvas.md'],
    ['COM1', 'COM1-canvas.md'],
    ['lpt9', 'lpt9-canvas.md'],
  ])('avoids Windows-reserved filename %s -> %s', (input, expected) => {
    expect(markdownFilenameOf(input)).toBe(expected);
  });

  it('leaves non-reserved names untouched', () => {
    expect(markdownFilenameOf('COM0')).toBe('COM0.md');
    expect(markdownFilenameOf('Content')).toBe('Content.md');
  });
});

describe('canvasExportMarkdownOf', () => {
  it('exports mentions as @Name instead of <@userId>', () => {
    const editor = buildEditorFromExtensions(
      createCanvasExtension(
        { snapshotJson: null, markdown: 'Ask <@u1> today' },
        new Map([['u1', 'Linh']])
      )
    );
    expect(canvasExportMarkdownOf(editor)).toBe('Ask @Linh today');
    editor.dispose();
  });

  it('separates column cells with blank lines', () => {
    const editor = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson: null, markdown: '' })
    );
    editor.update(
      () => {
        const left = $createLayoutItemNode().append(
          $createParagraphNode().append($createTextNode('Left text'))
        );
        const right = $createLayoutItemNode().append(
          $createParagraphNode().append($createTextNode('Right text'))
        );
        const container = $createLayoutContainerNode('1fr 1fr').append(
          left,
          right
        );
        $getRoot().clear().append(container);
      },
      { discrete: true }
    );
    expect(canvasExportMarkdownOf(editor)).toBe('Left text\n\nRight text');
    editor.dispose();
  });

  it('serializes message embeds as links', () => {
    const editor = buildEditorFromExtensions(
      createCanvasExtension({ snapshotJson: null, markdown: '' })
    );
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append(
            $createParagraphNode().append($createTextNode('Context')),
            $createMessageEmbedNode('msg_123')
          );
      },
      { discrete: true }
    );
    expect(
      canvasExportMarkdownOf(editor, {
        resolveMessageUrl: (id) =>
          `http://localhost:3000/channels/c1?message=${id}`,
      })
    ).toBe(
      'Context\n\n[Embedded message](http://localhost:3000/channels/c1?message=msg_123)'
    );
    expect(canvasExportMarkdownOf(editor)).toBe(
      'Context\n\n[Embedded message](?message=msg_123)'
    );
    editor.dispose();
  });
});
