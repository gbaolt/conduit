import { describe, expect, it } from 'vitest';

import type { ActivityKind, FeedEntry } from '@/schemas/feed';

import { foldFeed, rankFeed } from './feed-ranking';

const MINUTE = 60_000;

function entry(
  id: string,
  kind: ActivityKind,
  minutesAgo: number,
  overrides: Partial<FeedEntry> = {}
): FeedEntry {
  return {
    id,
    kind,
    room: { id: 'r1', name: 'design', kind: 'channel' },
    actor: { id: 'u2', name: 'Linh', image: null },
    message: { id: `m-${id}`, parentId: null, body: '', deletedAt: null },
    readAt: null,
    createdAt: new Date(Date.UTC(2026, 10, 13, 12) - minutesAgo * MINUTE),
    ...overrides,
  };
}

const ids = (groups: { entries: { id: string }[] }[]) =>
  groups.map((group) => group.entries.map((e) => e.id));

describe('foldFeed', () => {
  it('folds reactions to one message and keeps those to another apart', () => {
    const groups = foldFeed([
      entry('a1', 'reaction', 1, { emoji: '👍' }),
      entry('b1', 'reaction', 2, {
        emoji: '🎉',
        message: { id: 'other', parentId: null, body: '', deletedAt: null },
      }),
      entry('a2', 'reaction', 300, {
        emoji: '🎉',
        actor: { id: 'u3', name: 'Bao', image: null },
        message: { id: 'm-a1', parentId: null, body: '', deletedAt: null },
      }),
    ]);

    expect(ids(groups)).toEqual([['a1', 'a2'], ['b1']]);
    expect(groups[0]?.id).toBe('a1');
  });

  it('folds channel adds by one person within an hour, and no one else', () => {
    const bao = { id: 'u3', name: 'Bao', image: null };
    const groups = foldFeed([
      entry('c1', 'room_add', 0),
      entry('c2', 'room_add', 10, { actor: bao }),
      entry('c3', 'room_add', 30),
      entry('c4', 'room_add', 61),
    ]);

    expect(ids(groups)).toEqual([['c1', 'c3'], ['c2'], ['c4']]);
  });

  it('never folds mentions or replies, and keeps the order of the newest entries', () => {
    const groups = foldFeed([
      entry('a', 'mention', 1),
      entry('b', 'thread_reply', 2),
      entry('c', 'mention', 3),
    ]);

    expect(ids(groups)).toEqual([['a'], ['b'], ['c']]);
  });
});

describe('rankFeed', () => {
  it('orders urgent, normal, then low, newest first within a tier', () => {
    const groups = foldFeed([
      entry('react', 'reaction', 1),
      entry('plain-new', 'mention', 2),
      entry('urgent-old', 'mention', 50, { urgency: 'urgent' }),
      entry('plain-old', 'thread_reply', 60, { urgency: 'normal' }),
      entry('thanks', 'mention', 3, { urgency: 'low' }),
    ]);

    expect(ids(rankFeed(groups))).toEqual([
      ['urgent-old'],
      ['plain-new'],
      ['plain-old'],
      ['react'],
      ['thanks'],
    ]);
  });

  it('puts read groups after unread ones, then ranks them the same way', () => {
    const readAt = new Date(0);
    const groups = foldFeed([
      entry('read-urgent', 'mention', 1, { urgency: 'urgent', readAt }),
      entry('unread-low', 'mention', 5, { urgency: 'low' }),
      entry('read-plain', 'mention', 2, { readAt }),
    ]);

    expect(ids(rankFeed(groups))).toEqual([
      ['unread-low'],
      ['read-urgent'],
      ['read-plain'],
    ]);
  });

  it('counts a group with one unread entry as unread', () => {
    const same = { id: 'same', parentId: null, body: '', deletedAt: null };
    const groups = foldFeed([
      entry('r1', 'reaction', 1, { readAt: new Date(0), message: same }),
      entry('r2', 'reaction', 2, { message: same }),
      entry('m', 'mention', 3, { readAt: new Date(0) }),
    ]);

    expect(ids(rankFeed(groups))).toEqual([['r1', 'r2'], ['m']]);
  });

  it('ignores a stored urgency on a reaction', () => {
    const groups = foldFeed([
      entry('r', 'reaction', 1, { urgency: 'urgent' }),
      entry('m', 'mention', 5),
    ]);

    expect(ids(rankFeed(groups))).toEqual([['m'], ['r']]);
  });
});
