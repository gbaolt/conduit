import type { FeedEntry } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { type FeedPages, markEntriesRead } from '../queries';

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

describe('markEntriesRead', () => {
  it('marks only the named entries, across pages', () => {
    const data = pages([entry('a'), entry('b')], [entry('c')]);

    const next = markEntriesRead(data, now, ['b', 'c']);

    expect(next?.pages.flatMap((p) => p.entries.map((e) => e.readAt))).toEqual([
      null,
      now,
      now,
    ]);
  });

  it('marks every unread entry without ids, and keeps the time of one already read', () => {
    const earlier = new Date('2026-11-13T09:00:00Z');
    const data = pages([entry('a'), entry('b', earlier)]);

    const next = markEntriesRead(data, now);

    expect(next?.pages[0]?.entries.map((e) => e.readAt)).toEqual([
      now,
      earlier,
    ]);
  });

  it('leaves an uncached query alone', () => {
    expect(markEntriesRead(undefined, now, ['a'])).toBeUndefined();
  });
});
