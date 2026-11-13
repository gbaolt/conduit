import type { ActivityKind } from '@conduit/contract';

/** An item to write. `key` makes a retried write one row, per `(userId, key)`. */
export type NewActivityItem = {
  organizationId: string;
  /** The recipient. */
  userId: string;
  roomId: string;
  kind: ActivityKind;
  key: string;
  actorId: string;
  messageId?: string;
  emoji?: string;
};

/** What the rest of the feed reads from the database to decide who a sent message is for. */
export type RecipientLookup = {
  /** Current workspace members of the room. */
  memberIds: string[];
  /** Members online now. Empty unless the lookup asked for `here`. */
  onlineIds: string[];
  /** Authors of the thread's replies so far. Empty outside a thread. */
  repliers: string[];
};

/** Activity items. Items are written by the repositories of the changes that cause them, in the same transaction. */
export abstract class FeedRepository {
  abstract recipientLookup(input: {
    organizationId: string;
    roomId: string;
    /** The thread's root, when the message is a reply. */
    parentId?: string;
    /** Whether to read who is online. */
    here: boolean;
    now: Date;
  }): Promise<RecipientLookup>;
}
