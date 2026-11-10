import { buildEditorFromExtensions } from '@lexical/extension';
import { $nodesOfType } from 'lexical';
import { describe, expect, it } from 'vitest';

import { EmojiNode } from '@/components/editor/nodes/emoji-node';
import { MentionNode } from '@/components/editor/nodes/mention-node';

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

describe('composer emoji', () => {
  it.each([
    ['a flag', 'hello 🇻🇳 there'],
    ['a skin tone', '👍🏽'],
    ['two in a row', '🎉🚀 shipped'],
    ['bold', '**done ✅ now**'],
    ['inline code', 'run `echo 🚀` here'],
    ['fenced code', '```\n🚀\n```'],
  ])('keeps %s as typed', (_name, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('holds each emoji in its own node', () => {
    const editor = buildEditorFromExtensions(
      createComposerExtension('hi 🇻🇳 and 👍🏽!')
    );
    const emoji = editor.read(() =>
      $nodesOfType(EmojiNode).map((node) => node.getTextContent())
    );
    editor.dispose();
    expect(emoji).toEqual(['🇻🇳', '👍🏽']);
  });
});

describe('composer mentions', () => {
  const names = new Map([['u1', 'Linh Tran']]);

  function load(markdown: string) {
    const editor = buildEditorFromExtensions(
      createComposerExtension(markdown, names)
    );
    const result = {
      markdown: markdownOf(editor),
      mentions: editor.read(() =>
        $nodesOfType(MentionNode).map((node) => node.getTextContent())
      ),
    };
    editor.dispose();
    return result;
  }

  it('loads a user mention as a named node and writes it back as <@userId>', () => {
    expect(load('hi <@u1>, see this')).toEqual({
      markdown: 'hi <@u1>, see this',
      mentions: ['@Linh Tran'],
    });
  });

  it.each(['channel', 'here'])('keeps <@%s>', (target) => {
    expect(load(`<@${target}> look`)).toEqual({
      markdown: `<@${target}> look`,
      mentions: [`@${target}`],
    });
  });

  it('labels a mention of an unknown member', () => {
    expect(load('<@ghost>').mentions).toEqual(['@unknown member']);
  });
});
