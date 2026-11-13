import type { FeedEntry } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { feedEntryHref } from '../feed-entry-href';

const entry = (overrides: Partial<FeedEntry> = {}): FeedEntry => ({
  id: 'a1',
  kind: 'mention',
  room: { id: 'r1', name: 'design', kind: 'channel' },
  actor: { id: 'u1', name: 'Linh', image: null },
  message: { id: 'm1', parentId: null, body: 'hi', deletedAt: null },
  readAt: null,
  createdAt: new Date(0),
  ...overrides,
});

describe('feedEntryHref', () => {
  it('opens a message in its channel', () => {
    expect(feedEntryHref(entry())).toBe('/channels/r1?message=m1');
  });

  it('opens a reply in its thread panel', () => {
    const reply = entry({
      message: { id: 'm2', parentId: 'm1', body: 'hi', deletedAt: null },
    });

    expect(feedEntryHref(reply)).toBe('/channels/r1?thread=m1&message=m2');
  });

  it('opens a DM message under /dms', () => {
    const dm = entry({ room: { id: 'd1', name: '', kind: 'dm' } });

    expect(feedEntryHref(dm)).toBe('/dms/d1?message=m1');
  });

  it('opens the channel for a channel add', () => {
    expect(feedEntryHref(entry({ kind: 'room_add', message: undefined }))).toBe(
      '/channels/r1'
    );
  });
});
