import type { Message } from '@conduit/contract';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  cacheMessage,
  flattenMessages,
  mapMessage,
  type MessagePages,
  messagesQuery,
  patchCachedMessage,
  pinnedIsStale,
  repliesQuery,
  threadRootQuery,
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

describe('cacheMessage and patchCachedMessage', () => {
  const root = message({ id: 'root', channelId: 'c1' });
  const quiet = message({ id: 'quiet', parentId: 'root' });
  const loud = message({
    id: 'loud',
    parentId: 'root',
    alsoSentToChannel: true,
  });

  function seeded() {
    const client = new QueryClient();
    client.setQueryData(
      messagesQuery('c1').queryKey,
      pages({ messages: [root], hasMore: false })
    );
    client.setQueryData(
      repliesQuery('root').queryKey,
      pages({ messages: [], hasMore: false })
    );
    client.setQueryData(threadRootQuery('root').queryKey, root);
    return client;
  }

  const channelIds = (client: QueryClient) =>
    flattenMessages(client.getQueryData(messagesQuery('c1').queryKey)).map(
      (m) => m.id
    );
  const replyIds = (client: QueryClient) =>
    flattenMessages(client.getQueryData(repliesQuery('root').queryKey)).map(
      (m) => m.id
    );

  it('keeps a quiet reply out of the channel log', () => {
    const client = seeded();

    cacheMessage(client, quiet);

    expect(replyIds(client)).toEqual(['quiet']);
    expect(channelIds(client)).toEqual(['root']);
  });

  it('puts a reply sent to the channel in both lists', () => {
    const client = seeded();

    cacheMessage(client, loud);

    expect(replyIds(client)).toEqual(['loud']);
    expect(channelIds(client)).toEqual(['root', 'loud']);
  });

  it('refreshes the thread panel root and the log when the root changes', () => {
    const client = seeded();
    const changed = { ...root, replyCount: 3, updatedAt: new Date(99_000) };

    cacheMessage(client, changed);

    expect(
      client.getQueryData(threadRootQuery('root').queryKey)?.replyCount
    ).toBe(3);
    expect(
      flattenMessages(client.getQueryData(messagesQuery('c1').queryKey))[0]
        ?.replyCount
    ).toBe(3);
  });

  it('changes a message in the log, a thread, and the thread root', () => {
    const client = seeded();
    cacheMessage(client, quiet);

    const mark = (m: Message) => ({ ...m, body: 'marked' });
    patchCachedMessage(client, 'c1', 'quiet', mark);
    patchCachedMessage(client, 'c1', 'root', mark);

    expect(
      flattenMessages(client.getQueryData(repliesQuery('root').queryKey))[0]
        ?.body
    ).toBe('marked');
    expect(
      flattenMessages(client.getQueryData(messagesQuery('c1').queryKey))[0]
        ?.body
    ).toBe('marked');
    expect(client.getQueryData(threadRootQuery('root').queryKey)?.body).toBe(
      'marked'
    );
  });
});

describe('pinnedIsStale', () => {
  const pinned = message({ id: 'p', pinnedAt: new Date(5000) });

  it('is false until the list has loaded', () => {
    expect(pinnedIsStale(undefined, [pinned])).toBe(false);
  });

  it('is false when the list already holds the same version', () => {
    expect(pinnedIsStale([pinned], [pinned])).toBe(false);
  });

  it('is true for a message pinned that the list lacks', () => {
    expect(pinnedIsStale([], [pinned])).toBe(true);
  });

  it('is true for a listed message that was unpinned', () => {
    const unpinned = {
      ...pinned,
      pinnedAt: null,
      updatedAt: new Date(pinned.updatedAt.getTime() + 1),
    };
    expect(pinnedIsStale([pinned], [unpinned])).toBe(true);
  });

  it('ignores an unpinned message the list never held', () => {
    expect(pinnedIsStale([pinned], [message({ id: 'x' })])).toBe(false);
  });

  it('ignores a deleted pinned message the list lacks', () => {
    const gone = { ...pinned, id: 'gone', deletedAt: new Date(6000) };
    expect(pinnedIsStale([], [gone])).toBe(false);
  });
});

describe('mapMessage', () => {
  it('changes one message and leaves the rest', () => {
    const a = message({ id: 'a' });
    const b = message({ id: 'b' });
    const data = pages({ messages: [b, a], hasMore: false });

    const result = mapMessage(data, 'a', (m) => ({ ...m, body: 'changed' }));

    expect(bodies(result)).toEqual(['changed', 'b']);
  });
});
