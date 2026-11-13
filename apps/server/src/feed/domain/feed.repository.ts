import type {
  ActivityKind,
  ActivityUrgency,
  FeedEntry,
  FeedFilter,
  FeedSource,
} from '@conduit/contract';

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

/** An unread mention or reply the model has not judged, with the message behind it. */
export type UnrankedItem = {
  id: string;
  kind: Extract<ActivityKind, 'mention' | 'thread_reply'>;
  /** The message's author. */
  actorId: string;
  body: string;
  mentionedUserIds: string[];
  sentAt: Date;
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
    /** Empty shows every source. */
    sources: FeedSource[];
    /** Empty matches everything. */
    q: string;
    before?: string;
    limit: number;
  }): Promise<{ entries: FeedEntry[]; hasMore: boolean } | null>;

  /** Sets `readAt` on the caller's own items in `ids`. Items already read, and ids of other members' items, change nothing. */
  abstract markRead(userId: string, ids: string[]): Promise<void>;

  /** Clears `readAt` on the caller's own items in `ids`. Ids of other members' items change nothing. */
  abstract markUnread(userId: string, ids: string[]): Promise<void>;

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

  /**
   * The caller's newest unread `MENTION` and `THREAD_REPLY` items with no urgency, in rooms the caller is still in,
   * whose message was not deleted. Membership is the read check: a member can read every room they are in.
   */
  abstract unranked(input: {
    userId: string;
    organizationId: string;
    limit: number;
  }): Promise<UnrankedItem[]>;

  /** Stores the model's judgment on the caller's own items. Another member's id changes nothing. */
  abstract setUrgency(
    userId: string,
    ratings: { id: string; urgency: ActivityUrgency; reason: string }[]
  ): Promise<void>;

  /** Display names by user id. A user who no longer exists has no entry. */
  abstract userNames(userIds: string[]): Promise<Map<string, string>>;
}
