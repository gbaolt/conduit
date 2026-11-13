import type { FeedEntry } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { type FeedPages, normalizeSources, setEntriesRead } from '../queries';

const entry = (id: string, readAt: Date | null = null): FeedEntry => ({
  id,
  kind: 'mention',
  room: { id: 'r1', name: 'design', kind: 'channel' },
  actor: { id: 'u1', name: 'Linh', image: null },
  readAt,
  createdAt: new Date(0),
});

const pages = (...entries: FeedEntry[][]): FeedPages => ({
  pages: entries.map((page) => ({ entries: page, hasMore: false })),
  pageParams: entries.map(() => undefined),
});
const now = new Date('2026-11-13T12:00:00Z');

describe('setEntriesRead', () => {
  it('marks only the named entries, across pages', () => {
    const data = pages([entry('a'), entry('b')], [entry('c')]);

    const next = setEntriesRead(data, now, ['b', 'c']);

    expect(next?.pages.flatMap((p) => p.entries.map((e) => e.readAt))).toEqual([
      null,
      now,
      now,
    ]);
  });

  it('marks every unread entry without ids, and keeps the time of one already read', () => {
    const earlier = new Date('2026-11-13T09:00:00Z');
    const data = pages([entry('a'), entry('b', earlier)]);

    const next = setEntriesRead(data, now);

    expect(next?.pages[0]?.entries.map((e) => e.readAt)).toEqual([
      now,
      earlier,
    ]);
  });

  it('marks the named entries unread, and leaves unread ones as they are', () => {
    const data = pages([entry('a', now), entry('b'), entry('c', now)]);

    const next = setEntriesRead(data, null, ['a', 'b']);

    expect(next?.pages[0]?.entries.map((e) => e.readAt)).toEqual([
      null,
      null,
      now,
    ]);
  });

  it('leaves an uncached query alone', () => {
    expect(setEntriesRead(undefined, now, ['a'])).toBeUndefined();
  });
});

describe('normalizeSources', () => {
  it('spells one set one way, so equal filters share a cache entry', () => {
    expect(normalizeSources(['thread_reply', 'dm', 'dm'])).toEqual([
      'dm',
      'thread_reply',
    ]);
  });

  it('treats every source as no filter', () => {
    expect(
      normalizeSources([
        'room_add',
        'reaction',
        'thread_reply',
        'mention',
        'dm',
      ])
    ).toEqual([]);
  });
});
