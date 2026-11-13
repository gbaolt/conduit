import { describe, expect, it } from 'vitest';

import {
  type FeedContext,
  feedItemsFor,
  reactionItemFor,
  roomAddItemFor,
} from './feed-recipients';

const context: FeedContext = {
  organizationId: 'org',
  memberIds: ['author', 'ann', 'bo', 'cy'],
  onlineIds: ['bo', 'author', 'ghost'],
  repliers: [],
  rootAuthorId: null,
};

const message = {
  id: 'm1',
  roomId: 'r1',
  authorId: 'author',
  parentId: null,
  mentionedUserIds: [],
  mentionsChannel: false,
  mentionsHere: false,
};

const recipients = (items: ReturnType<typeof feedItemsFor>) =>
  items.map((item) => `${item.userId}:${item.kind}`);

describe('feedItemsFor', () => {
  it('gives a MENTION to each member the message names', () => {
    const items = feedItemsFor(
      { ...message, mentionedUserIds: ['ann'] },
      context
    );

    expect(items).toEqual([
      {
        organizationId: 'org',
        userId: 'ann',
        roomId: 'r1',
        kind: 'mention',
        key: 'message:m1',
        actorId: 'author',
        messageId: 'm1',
      },
    ]);
  });

  it('gives @channel to every member but the author', () => {
    const items = feedItemsFor({ ...message, mentionsChannel: true }, context);

    expect(recipients(items)).toEqual([
      'ann:mention',
      'bo:mention',
      'cy:mention',
    ]);
  });

  it('gives @here to the members online, and to nobody when none are', () => {
    expect(
      recipients(feedItemsFor({ ...message, mentionsHere: true }, context))
    ).toEqual(['bo:mention']);
    expect(
      feedItemsFor(
        { ...message, mentionsHere: true },
        { ...context, onlineIds: [] }
      )
    ).toEqual([]);
  });

  it('never gives a non-member an item, so a private channel cannot leak', () => {
    const items = feedItemsFor(
      { ...message, mentionedUserIds: ['ghost'], mentionsHere: true },
      context
    );

    expect(recipients(items)).toEqual(['bo:mention']);
  });

  it('never gives the author an item for a self mention', () => {
    expect(
      feedItemsFor({ ...message, mentionedUserIds: ['author'] }, context)
    ).toEqual([]);
  });

  describe('in a thread', () => {
    const reply = { ...message, parentId: 'root' };
    const thread = { ...context, rootAuthorId: 'ann', repliers: ['bo'] };

    it('gives the root author and earlier repliers a THREAD_REPLY', () => {
      expect(recipients(feedItemsFor(reply, thread))).toEqual([
        'ann:thread_reply',
        'bo:thread_reply',
      ]);
    });

    it('gives a mention inside a reply one MENTION and no THREAD_REPLY', () => {
      const items = feedItemsFor(
        { ...reply, mentionedUserIds: ['ann'] },
        thread
      );

      expect(recipients(items)).toEqual(['ann:mention', 'bo:thread_reply']);
    });

    it('skips the author when they are the root author or an earlier replier', () => {
      expect(
        feedItemsFor(reply, { ...thread, rootAuthorId: 'author', repliers: [] })
      ).toEqual([]);
    });

    it('gives a repeat replier one item', () => {
      const items = feedItemsFor(reply, { ...thread, repliers: ['ann', 'bo'] });

      expect(recipients(items)).toEqual([
        'ann:thread_reply',
        'bo:thread_reply',
      ]);
    });

    it('gives a thread member who left the room nothing', () => {
      const items = feedItemsFor(reply, { ...thread, repliers: ['gone'] });

      expect(recipients(items)).toEqual(['ann:thread_reply']);
    });
  });

  it('gives a top-level message no THREAD_REPLY even when the context names repliers', () => {
    const items = feedItemsFor(message, {
      ...context,
      rootAuthorId: 'ann',
      repliers: ['bo'],
    });

    expect(items).toEqual([]);
  });
});

describe('reactionItemFor', () => {
  const target = { id: 'm1', roomId: 'r1', authorId: 'ann' };

  it('keys the item by message, actor, and emoji for the message author', () => {
    expect(
      reactionItemFor(target, {
        actorId: 'bo',
        emoji: '👍',
        organizationId: 'org',
      })
    ).toEqual({
      organizationId: 'org',
      userId: 'ann',
      roomId: 'r1',
      kind: 'reaction',
      key: 'reaction:m1:bo:👍',
      actorId: 'bo',
      messageId: 'm1',
      emoji: '👍',
    });
  });

  it('writes nothing when the author reacts to their own message', () => {
    expect(
      reactionItemFor(target, {
        actorId: 'ann',
        emoji: '👍',
        organizationId: 'org',
      })
    ).toBeNull();
  });
});

describe('roomAddItemFor', () => {
  const add = (joinedAt: Date) =>
    roomAddItemFor({
      organizationId: 'org',
      roomId: 'r1',
      userId: 'bo',
      actorId: 'ann',
      joinedAt,
    });

  it('makes being added again after a removal a new item', () => {
    expect(add(new Date(1000)).key).toBe('room-add:r1:1000');
    expect(add(new Date(2000)).key).not.toBe(add(new Date(1000)).key);
  });
});
