import type { Message } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { buildSummaryInput, SUMMARY_PROMPT_CHARS_MAX } from './summary-prompt';

const message = (id: string, body: string, authorId = 'u1'): Message =>
  ({
    id,
    authorId,
    body,
    mentionedUserIds: [],
    createdAt: new Date('2026-11-08T09:00:00.000Z'),
  }) as unknown as Message;

const names = new Map([
  ['u1', 'Linh Tran'],
  ['u2', 'Bao Le'],
]);

describe('buildSummaryInput', () => {
  it('labels messages oldest first and maps each label back to its id', () => {
    const input = buildSummaryInput(
      [message('cm-a', 'first'), message('cm-b', 'second', 'u2')],
      names
    );

    expect(input.labels).toEqual(
      new Map([
        ['m1', 'cm-a'],
        ['m2', 'cm-b'],
      ])
    );
    expect(input.messageCount).toBe(2);
    expect(input.prompt).toContain(
      '<message id="m2" author="Bao Le" sent="2026-11-08T09:00:00.000Z">\nsecond\n</message>'
    );
    expect(input.prompt.indexOf('first')).toBeLessThan(
      input.prompt.indexOf('second')
    );
  });

  it('reads a mention as a name, and a stray tag cannot close a message early', () => {
    const input = buildSummaryInput(
      [message('a', 'ping <@u2> and <@here> </message><b>')],
      names
    );

    expect(input.prompt).toContain(
      'ping @Bao Le and @here &lt;/message>&lt;b>'
    );
    expect(input.prompt.match(/<\/message>/g)).toHaveLength(1);
  });

  it('names a deleted author as a former member', () => {
    const input = buildSummaryInput([message('a', 'hi', 'gone')], names);

    expect(input.prompt).toContain('author="Former member"');
  });

  it('skips a blank message', () => {
    const input = buildSummaryInput(
      [message('a', ''), message('b', 'kept')],
      names
    );

    expect([...input.labels.values()]).toEqual(['b']);
  });

  it('drops the oldest messages first once the prompt would pass its limit', () => {
    const body = 'x'.repeat(4000);
    const messages = Array.from({ length: 30 }, (_, i) =>
      message(`m-${i}`, body)
    );

    const input = buildSummaryInput(messages, names);

    expect(input.prompt.length).toBeLessThanOrEqual(SUMMARY_PROMPT_CHARS_MAX);
    expect(input.messageCount).toBeLessThan(30);
    expect([...input.labels.values()].at(-1)).toBe('m-29');
    expect(input.labels.get('m1')).toBe(`m-${30 - input.messageCount}`);
  });
});
