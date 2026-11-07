import type { Message } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import {
  flattenMessages,
  markDeleted,
  type MessagePages,
  upsertMessages,
} from '../queries';

let counter = 0;
function message(overrides: Partial<Message> & { id: string }): Message {
  counter += 1;
  return {
    channelId: 'c1',
    authorId: 'u1',
    clientId: `k${counter}`,
    parentId: null,
    alsoSentToChannel: false,
    body: overrides.id,
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
    createdAt: new Date(1000 * counter),
    updatedAt: new Date(1000 * counter),
    ...overrides,
  };
}

const pages = (
  ...groups: { messages: Message[]; hasMore: boolean }[]
): MessagePages => ({
  pages: groups,
  pageParams: groups.map((_, i) => (i === 0 ? undefined : `p${i}`)),
});

const bodies = (data: MessagePages | undefined) =>
  flattenMessages(data).map((m) => m.body);

describe('upsertMessages', () => {
  const a = message({ id: 'a' });
  const b = message({ id: 'b' });

  it('adds a new message in order, newest page first', () => {
    const c = message({ id: 'c' });
    const data = pages({ messages: [b, a], hasMore: false });

    const next = upsertMessages(data, [c]);

    expect(next?.pages[0]?.messages.map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('replaces a known message with a newer version', () => {
    const edited = { ...a, body: 'edited', updatedAt: new Date(99_999) };

    const next = upsertMessages(pages({ messages: [b, a], hasMore: false }), [
      edited,
    ]);

    expect(bodies(next)).toEqual(['edited', 'b']);
  });

  it('keeps a known message when the incoming version is older', () => {
    const newer = { ...a, body: 'newer', updatedAt: new Date(99_999) };
    const data = pages({ messages: [b, newer], hasMore: false });

    expect(upsertMessages(data, [a])).toBe(data);
  });

  it('replaces a message that sits on an older page', () => {
    const edited = { ...a, body: 'edited', updatedAt: new Date(99_999) };
    const data = pages(
      { messages: [b], hasMore: true },
      { messages: [a], hasMore: false }
    );

    const next = upsertMessages(data, [edited]);

    expect(next?.pages[1]?.messages[0]?.body).toBe('edited');
  });

  it('skips an unknown message older than everything loaded while older pages remain', () => {
    const older = message({ id: 'old', createdAt: new Date(1) });
    const data = pages({ messages: [b, a], hasMore: true });

    expect(upsertMessages(data, [older])).toBe(data);
  });

  it('adds the same incoming message once', () => {
    const c = message({ id: 'c' });
    const data = pages({ messages: [b, a], hasMore: false });

    const next = upsertMessages(data, [c, c]);

    expect(bodies(next)).toEqual(['a', 'b', 'c']);
  });

  it('does nothing before the first page has loaded', () => {
    expect(upsertMessages(undefined, [a])).toBeUndefined();
  });
});

describe('flattenMessages', () => {
  it('orders oldest first and breaks ties by id', () => {
    const at = new Date(5000);
    const data = pages({
      messages: [
        message({ id: 'z', createdAt: at }),
        message({ id: 'y', createdAt: at }),
        message({ id: 'x', createdAt: new Date(1) }),
      ],
      hasMore: false,
    });

    expect(bodies(data)).toEqual(['x', 'y', 'z']);
  });

  it('drops a deleted message without replies and keeps one with replies', () => {
    const data = pages({
      messages: [
        message({ id: 'gone', deletedAt: new Date() }),
        message({ id: 'root', deletedAt: new Date(), replyCount: 2 }),
      ],
      hasMore: false,
    });

    expect(bodies(data)).toEqual(['root']);
  });
});

describe('markDeleted', () => {
  it('clears the body and sets deletedAt', () => {
    const a = message({ id: 'a' });
    const at = new Date(7000);

    const next = markDeleted(pages({ messages: [a], hasMore: false }), 'a', at);

    expect(next?.pages[0]?.messages[0]).toMatchObject({
      body: '',
      deletedAt: at,
    });
  });
});
