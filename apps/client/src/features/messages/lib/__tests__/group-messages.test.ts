import type { Message } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { PendingMessage } from '@/services/messages/hooks';

import { buildLog, dayLabel } from '../group-messages';

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute);

function message(
  id: string,
  authorId: string,
  createdAt: Date,
  overrides: Partial<Message> = {}
): Message {
  return {
    id,
    channelId: 'c1',
    authorId,
    clientId: `k-${id}`,
    parentId: null,
    alsoSentToChannel: false,
    body: id,
    mentionedUserIds: [],
    mentionsChannel: false,
    mentionsHere: false,
    reactions: {},
    replyCount: 0,
    lastReplyAt: null,
    linkPreview: null,
    pinnedAt: null,
    pinnedById: null,
    editedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

const flags = (log: ReturnType<typeof buildLog>) =>
  log.map((row) => [row.grouped, row.startsDay]);

describe('buildLog', () => {
  it('groups one author within five minutes', () => {
    const log = buildLog(
      [
        message('a', 'u1', at(7, 9, 0)),
        message('b', 'u1', at(7, 9, 4)),
        message('c', 'u1', at(7, 9, 10)),
      ],
      [],
      'me'
    );

    expect(flags(log)).toEqual([
      [false, true],
      [true, false],
      [false, false],
    ]);
  });

  it('starts a group when the author changes', () => {
    const log = buildLog(
      [message('a', 'u1', at(7, 9)), message('b', 'u2', at(7, 9, 1))],
      [],
      'me'
    );

    expect(log.map((row) => row.grouped)).toEqual([false, false]);
  });

  it('starts a day and a group at midnight', () => {
    const log = buildLog(
      [
        message('a', 'u1', new Date(2026, 10, 6, 23, 59)),
        message('b', 'u1', new Date(2026, 10, 7, 0, 1)),
      ],
      [],
      'me'
    );

    expect(flags(log)).toEqual([
      [false, true],
      [false, true],
    ]);
  });

  it('starts a group at the New marker', () => {
    const log = buildLog(
      [message('a', 'u1', at(7, 9)), message('b', 'u1', at(7, 9, 1))],
      [],
      'me',
      'b'
    );

    expect(log.map((row) => [row.grouped, row.startsNew])).toEqual([
      [false, false],
      [false, true],
    ]);
  });

  it('does not group a row under a deleted one', () => {
    const log = buildLog(
      [
        message('a', 'u1', at(7, 9), { deletedAt: at(7, 10), replyCount: 1 }),
        message('b', 'u1', at(7, 9, 1)),
      ],
      [],
      'me'
    );

    expect(log.map((row) => row.grouped)).toEqual([false, false]);
  });

  it('appends a pending message as the viewer and drops one the server returned', () => {
    const pending = (clientId: string): PendingMessage => ({
      clientId,
      channelId: 'c1',
      body: clientId,
      createdAt: at(7, 9, 2),
      status: 'sending',
    });
    const log = buildLog(
      [message('a', 'me', at(7, 9))],
      [pending('k-a'), pending('new')],
      'me'
    );

    expect(log.map((row) => row.key)).toEqual(['a', 'pending-new']);
    expect(log[1]).toMatchObject({ kind: 'pending', grouped: true });
  });
});

describe('dayLabel', () => {
  const now = at(7, 15);

  it.each([
    [at(7, 1), 'Today'],
    [at(6, 23), 'Yesterday'],
  ])('labels %s as %s', (date, label) => {
    expect(dayLabel(date, now)).toBe(label);
  });

  it('spells out an older day with its weekday', () => {
    expect(dayLabel(new Date(2026, 10, 4, 12), now)).toMatch(/Wednesday.*4/);
  });

  it('adds the year for another year', () => {
    expect(dayLabel(new Date(2025, 10, 4, 12), now)).toContain('2025');
  });
});
