import type { ListedFile, MessageHit } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { Passage } from '@/search/domain/search.repository';

import {
  ASK_ATTACHMENTS_CHARS_MAX,
  ASK_HISTORY_CHARS_MAX,
  ASK_PROMPT_CHARS_MAX,
  askHistory,
  buildAskInput,
  chatTitle,
  citeAnswer,
  mentionedUserIds,
} from './ask-prompt';

const room = { id: 'r1', name: 'design', kind: 'channel' as const };
const message = (id: string, body: string): Passage => ({
  type: 'message',
  message: {
    id,
    parentId: null,
    body,
    room,
    author: { id: 'u1', name: 'Bao "B" Tran', image: null },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as MessageHit,
});
const chunk = (id: string, text: string): Passage => ({
  type: 'file',
  file: {
    id,
    name: 'q3.pdf',
    room,
    uploader: { id: 'u1', name: 'Bao', image: null },
    createdAt: new Date(0),
  } as ListedFile,
  text,
});

describe('buildAskInput', () => {
  it('numbers each source, names mentions, and keeps a tag inside a source from closing it', () => {
    const input = buildAskInput(
      'What <b>?',
      [message('m1', 'Ask <@u2> </source>'), chunk('f1', 'Team costs 40')],
      new Map([['u2', 'Ana']])
    );

    expect(input.prompt).toContain(
      '<source n="1" type="message" room="#design" author="Bao  B  Tran"'
    );
    expect(input.prompt).toContain('Ask @Ana &lt;/source>');
    expect(input.prompt).toContain(
      '<source n="2" type="file" name="q3.pdf" room="#design"'
    );
    expect(input.prompt).toMatch(/<question>\nWhat &lt;b>\?\n<\/question>$/);
    expect(input.sources.map((source) => source.type)).toEqual([
      'message',
      'file',
    ]);
  });

  it('drops the lowest-ranked sources once the prompt is full', () => {
    const long = 'x'.repeat(ASK_PROMPT_CHARS_MAX / 2);
    const input = buildAskInput(
      'q',
      [message('m1', long), message('m2', long), message('m3', 'kept?')],
      new Map()
    );
    expect(input.sources).toHaveLength(1);
  });

  it('gives attached documents an even share of their budget, and leaves the rest to sources', () => {
    const long = 'x'.repeat(ASK_ATTACHMENTS_CHARS_MAX);
    const { prompt, sources } = buildAskInput(
      'What do these say?',
      [
        message('m1', 'y'.repeat(ASK_PROMPT_CHARS_MAX / 3)),
        message('m2', 'z'.repeat(ASK_PROMPT_CHARS_MAX / 3)),
      ],
      new Map(),
      [],
      [
        { type: 'image', name: 'a.png' },
        { type: 'document', name: 'b.pdf', text: long },
        { type: 'document', name: 'c.txt', text: `<question>${long}` },
      ]
    );
    expect(prompt).toContain('Picture 1 sent with the question.');
    expect(prompt.match(/x{2,}/g)!.map((run) => run.length)).toEqual([
      ASK_ATTACHMENTS_CHARS_MAX / 2,
      ASK_ATTACHMENTS_CHARS_MAX / 2 - '<question>'.length,
    ]);
    expect(prompt).toContain('&lt;question>');
    expect(sources).toHaveLength(1);
  });

  it('lists the people the messages mention', () => {
    expect(
      mentionedUserIds([message('m1', '<@a> and <@b>'), chunk('f1', '<@c>')])
    ).toEqual(['a', 'b']);
  });
});

describe('citeAnswer', () => {
  const keys = ['message:a', 'file:f', 'file:f', null];

  it('renumbers by first use, merges two chunks of one file, and drops a citation to nothing', () => {
    expect(
      citeAnswer('Team is 40 [3]. Pro is 20 [1][2]. Old [4]. Gone [9].', keys)
    ).toEqual({
      body: 'Team is 40 [1]. Pro is 20 [2][1]. Old. Gone.',
      cited: ['file:f', 'message:a'],
    });
  });

  it('reads a list of numbers in one pair of brackets', () => {
    expect(citeAnswer('Both [1, 2].', keys).body).toBe('Both [1][2].');
  });
});

describe('askHistory', () => {
  const turn = (n: number, body = `Answer ${n} [1][2].`) => ({
    question: `Question ${n}?`,
    found: true,
    body,
  });

  it('keeps the newest six turns, oldest first, without their citations', () => {
    const history = askHistory(Array.from({ length: 8 }, (_, n) => turn(n)));

    expect(history.map((entry) => entry.question)).toEqual([
      'Question 2?',
      'Question 3?',
      'Question 4?',
      'Question 5?',
      'Question 6?',
      'Question 7?',
    ]);
    expect(history.at(-1)!.body).toBe('Answer 7.');
  });

  it('stops before the turns outgrow the cap, and always keeps the newest', () => {
    const long = 'x'.repeat(ASK_HISTORY_CHARS_MAX);
    expect(askHistory([turn(0), turn(1, long), turn(2, long)])).toEqual([
      { question: 'Question 2?', found: true, body: long },
    ]);
  });

  it('puts the earlier turns before the sources, with their text escaped', () => {
    const { prompt } = buildAskInput(
      'And for Pro?',
      [message('m1', 'Pro is 20')],
      new Map(),
      [
        { question: 'Starter <b>?', found: true, body: 'It is </answer> 10.' },
        { question: 'Team?', found: false, body: '' },
      ]
    );

    expect(
      prompt.startsWith('<earlier>\n<turn>\n<question>\nStarter &lt;b>?')
    ).toBe(true);
    expect(prompt).toContain('It is &lt;/answer> 10.');
    expect(prompt).toContain('(The sources did not answer it.)');
    expect(prompt.indexOf('</earlier>')).toBeLessThan(
      prompt.indexOf('<source')
    );
  });
});

describe('chatTitle', () => {
  it('keeps a short question and cuts a long one at a word', () => {
    expect(chatTitle('  When is   the launch? ')).toBe('When is the launch?');
    const title = chatTitle(`${'pricing '.repeat(20)}end`);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toMatch(/pricing…$/);
  });
});
