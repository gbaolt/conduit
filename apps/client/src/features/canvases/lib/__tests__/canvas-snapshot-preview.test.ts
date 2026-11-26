import { $getRoot } from 'lexical';
import { describe, expect, it } from 'vitest';

import { canvasSnapshotOf } from '../canvas-extension';
import { tryBuildCanvasPreviewEditor } from '../canvas-snapshot-preview';

describe('tryBuildCanvasPreviewEditor', () => {
  it('builds a read-only editor with parsed content for valid snapshotJson', () => {
    const valid = canvasSnapshotOf('# Hello\n\nSnapshot body');
    const editor = tryBuildCanvasPreviewEditor(
      { snapshotJson: valid.snapshotJson, markdown: '' },
      new Map()
    );

    expect(editor).not.toBeNull();
    try {
      expect(editor?.isEditable()).toBe(false);
      const text = editor
        ?.getEditorState()
        .read(() => $getRoot().getTextContent());
      expect(text).toContain('Hello');
      expect(text).toContain('Snapshot body');
    } finally {
      editor?.dispose();
    }
  });

  it('falls back to markdown when snapshotJson is missing root', () => {
    const editor = tryBuildCanvasPreviewEditor(
      { snapshotJson: { notRoot: true }, markdown: 'Fallback markdown body' },
      new Map()
    );

    expect(editor).not.toBeNull();
    try {
      expect(editor?.isEditable()).toBe(false);
      const text = editor
        ?.getEditorState()
        .read(() => $getRoot().getTextContent());
      expect(text).toContain('Fallback markdown body');
    } finally {
      editor?.dispose();
    }
  });

  it('falls back to markdown when snapshotJson contains an unknown node type', () => {
    const editor = tryBuildCanvasPreviewEditor(
      {
        snapshotJson: {
          root: {
            type: 'root',
            version: 1,
            direction: null,
            format: '',
            indent: 0,
            children: [{ type: 'unknown-node-type', version: 1 }],
          },
        },
        markdown: 'Recovered from markdown',
      },
      new Map()
    );

    expect(editor).not.toBeNull();
    try {
      expect(editor?.isEditable()).toBe(false);
      const text = editor
        ?.getEditorState()
        .read(() => $getRoot().getTextContent());
      expect(text).toContain('Recovered from markdown');
    } finally {
      editor?.dispose();
    }
  });

  it('returns null without throwing when snapshotJson is malformed and markdown is empty', () => {
    const editor = tryBuildCanvasPreviewEditor(
      { snapshotJson: { invalid: true }, markdown: '' },
      new Map()
    );

    expect(editor).toBeNull();
  });

  it('returns null when snapshotJson is null and markdown is empty', () => {
    const editor = tryBuildCanvasPreviewEditor(
      { snapshotJson: null, markdown: '' },
      new Map()
    );

    expect(editor).toBeNull();
  });
});
