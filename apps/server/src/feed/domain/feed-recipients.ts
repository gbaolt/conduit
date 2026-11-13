import type { Message } from '@conduit/contract';

import type { NewActivityItem, RecipientLookup } from './feed.repository';

export type FeedContext = RecipientLookup & {
  organizationId: string;
  /** The author of the thread's root, when the message is a reply. */
  rootAuthorId: string | null;
};

type FeedMessage = Pick<
  Message,
  | 'id'
  | 'roomId'
  | 'authorId'
  | 'parentId'
  | 'mentionedUserIds'
  | 'mentionsChannel'
  | 'mentionsHere'
>;

/**
 * The items one sent message causes, in this order of rule: a `MENTION` for each member it names, for every member
 * with `@channel`, and for the members online with `@here`. Then a `THREAD_REPLY` for the thread's root author and
 * earlier repliers who got no `MENTION`. The author never gets an item, and a non-member never does.
 */
export function feedItemsFor(
  message: FeedMessage,
  context: FeedContext
): NewActivityItem[] {
  const members = new Set(context.memberIds);
  const mentioned = new Set(message.mentionedUserIds);
  if (message.mentionsChannel) {
    for (const id of context.memberIds) mentioned.add(id);
  }
  if (message.mentionsHere) {
    for (const id of context.onlineIds) mentioned.add(id);
  }

  const replied = new Set<string>();
  if (message.parentId) {
    if (context.rootAuthorId) replied.add(context.rootAuthorId);
    for (const id of context.repliers) replied.add(id);
  }

  const item = (
    userId: string,
    kind: 'mention' | 'thread_reply'
  ): NewActivityItem => ({
    organizationId: context.organizationId,
    userId,
    roomId: message.roomId,
    kind,
    key: `message:${message.id}`,
    actorId: message.authorId,
    messageId: message.id,
  });
  const eligible = (id: string) => id !== message.authorId && members.has(id);

  return [
    ...[...mentioned].filter(eligible).map((id) => item(id, 'mention')),
    ...[...replied]
      .filter((id) => eligible(id) && !mentioned.has(id))
      .map((id) => item(id, 'thread_reply')),
  ];
}

export const reactionKey = (
  messageId: string,
  actorId: string,
  emoji: string
) => `reaction:${messageId}:${actorId}:${emoji}`;

/** The item a reaction causes for the message's author, or null when the author reacted to their own message. */
export function reactionItemFor(
  message: Pick<Message, 'id' | 'roomId' | 'authorId'>,
  input: { actorId: string; emoji: string; organizationId: string }
): NewActivityItem | null {
  if (message.authorId === input.actorId) return null;
  return {
    organizationId: input.organizationId,
    userId: message.authorId,
    roomId: message.roomId,
    kind: 'reaction',
    key: reactionKey(message.id, input.actorId, input.emoji),
    actorId: input.actorId,
    messageId: message.id,
    emoji: input.emoji,
  };
}

/** One item for a member added to a channel. `joinedAt` is in the key, so being added again after a removal is a new item. */
export function roomAddItemFor(input: {
  organizationId: string;
  roomId: string;
  userId: string;
  actorId: string;
  joinedAt: Date;
}): NewActivityItem {
  return {
    organizationId: input.organizationId,
    userId: input.userId,
    roomId: input.roomId,
    kind: 'room_add',
    key: `room-add:${input.roomId}:${input.joinedAt.getTime()}`,
    actorId: input.actorId,
  };
}
