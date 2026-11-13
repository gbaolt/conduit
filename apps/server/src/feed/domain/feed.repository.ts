import type { ActivityKind, FeedEntry, FeedFilter } from '@conduit/contract';

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

  /**
   * The caller's items in the workspace, newest first, ordered by `(createdAt, id)`. An item in a room the caller
   * has left is hidden. Returns null when `before` is not one of the caller's items.
   */
  abstract list(input: {
    userId: string;
    organizationId: string;
    filter: FeedFilter;
    before?: string;
    limit: number;
  }): Promise<{ entries: FeedEntry[]; hasMore: boolean } | null>;

  /** Sets `readAt` on the caller's own items in `ids`. Items already read, and ids of other members' items, change nothing. */
  abstract markRead(userId: string, ids: string[]): Promise<void>;

  /** Sets `readAt` on every unread item of the caller in the workspace that `list` shows. */
  abstract markAllRead(userId: string, organizationId: string): Promise<void>;

  /**
   * Sets `readAt` on the caller's `MENTION` items in the room whose message the conversation shows and
   * whose time the caller's read position has reached.
   */
  abstract markReadThroughPosition(input: {
    roomId: string;
    userId: string;
  }): Promise<void>;
}
