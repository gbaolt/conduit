import type { Message } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { firstUnreadId } from '../first-unread';

const at = (minute: number) => new Date(2026, 10, 7, 10, minute);
const message = (
  id: string,
  authorId: string,
  minute: number,
  overrides: Partial<Message> = {}
) =>
  ({
    id,
    authorId,
    createdAt: at(minute),
    deletedAt: null,
    ...overrides,
  }) as Message;

const log = [
  message('a', 'bao', 1),
  message('b', 'linh', 5),
  message('c', 'viewer', 6),
  message('d', 'linh', 9),
];

describe('firstUnreadId', () => {
  it('points at the first message from someone else after the read time', () => {
    expect(firstUnreadId(log, at(3), 'viewer', false)).toBe('b');
  });

  it('skips the viewer’s own messages', () => {
    expect(firstUnreadId(log, at(5), 'viewer', false)).toBe('d');
  });

  it('is null when everything was read', () => {
    expect(firstUnreadId(log, at(9), 'viewer', false)).toBeNull();
  });

  it('is null when the first unread one may sit in older pages', () => {
    expect(firstUnreadId(log, at(0), 'viewer', true)).toBeNull();
    expect(firstUnreadId(log, at(0), 'viewer', false)).toBe('a');
  });

  it('keeps the marker when older pages remain but a read message precedes it', () => {
    expect(firstUnreadId(log, at(3), 'viewer', true)).toBe('b');
  });

  it('ignores deleted messages', () => {
    const deleted = [message('x', 'linh', 5, { deletedAt: at(6) }), log[3]!];
    expect(firstUnreadId(deleted, at(3), 'viewer', false)).toBe('d');
  });
});
