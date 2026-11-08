import { buildEditorFromExtensions } from '@lexical/extension';
import { describe, expect, it } from 'vitest';

import { createComposerExtension, markdownOf } from '../composer-extension';

function roundTrip(markdown: string) {
  const editor = buildEditorFromExtensions(createComposerExtension(markdown));
  const result = markdownOf(editor);
  editor.dispose();
  return result;
}

describe('composer Markdown', () => {
  it.each([
    ['bold', '**bold**'],
    ['italic', '*italic*'],
    ['strikethrough', '~~gone~~'],
    ['inline code', 'use `pnpm test` here'],
    ['link', 'see [the docs](https://example.com)'],
    ['bulleted list', '- one\n- two'],
    ['numbered list', '1. one\n2. two'],
    ['quote', '> quoted'],
    ['fenced code', '```ts\nconst a = 1;\n```'],
  ])('keeps %s when a message is loaded for editing', (_name, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('keeps a line break and a paragraph break', () => {
    expect(roundTrip('one\ntwo\n\nthree')).toBe('one\ntwo\n\nthree');
  });

  it('keeps text that looks like HTML as text', () => {
    expect(roundTrip('<img src=x onerror=alert(1)>')).toBe(
      '<img src=x onerror=alert(1)>'
    );
  });

  it('drops an empty list item left at the end', () => {
    expect(roundTrip('- one\n- ')).toBe('- one');
    expect(roundTrip('1. one\n2. ')).toBe('1. one');
  });

  it('starts empty without an initial message', () => {
    expect(roundTrip('')).toBe('');
  });
});
