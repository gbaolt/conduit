import {
  FEED_DELETED_BODY,
  FEED_EXCERPT_MAX,
  type FeedEntry,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { withExcerpt } from './feed-entry';

const entry = (message?: Partial<NonNullable<FeedEntry['message']>>) =>
  ({
    id: 'a1',
    kind: 'mention',
    room: { id: 'r1', name: 'design', kind: 'channel' },
    actor: { id: 'u1', name: 'Linh', image: null },
    message: message && {
      id: 'm1',
      parentId: null,
      body: 'hello',
      deletedAt: null,
      ...message,
    },
    readAt: null,
    createdAt: new Date(0),
  }) satisfies FeedEntry;

describe('withExcerpt', () => {
  it('keeps a short body as stored', () => {
    expect(withExcerpt(entry()).message).toBeUndefined();
    expect(withExcerpt(entry({ body: '**hi**' })).message?.body).toBe('**hi**');
  });

  it('cuts a long body to the excerpt length without splitting an emoji', () => {
    const body = '😀'.repeat(FEED_EXCERPT_MAX + 5);

    const cut = withExcerpt(entry({ body })).message?.body;

    expect([...(cut ?? '')]).toHaveLength(FEED_EXCERPT_MAX);
    expect(cut).toBe('😀'.repeat(FEED_EXCERPT_MAX));
  });

  it('shows a deleted message as the notice', () => {
    const deleted = entry({ body: '', deletedAt: new Date(1) });

    expect(withExcerpt(deleted).message?.body).toBe(FEED_DELETED_BODY);
  });
});
