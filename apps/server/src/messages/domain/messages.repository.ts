import type {
  LinkPreview,
  Message,
  ParsedMentions,
  ReactionSummary,
} from '@conduit/contract';

export type MessageMentions = Pick<ParsedMentions, 'channel' | 'here'> & {
  userIds: string[];
};

/** Messages. Callers check channel access first; this port knows only rows. */
export abstract class MessagesRepository {
  /**
   * Top-level messages of the channel, newest first, ordered by `(createdAt, id)`.
   * A deleted message stays only while it has replies. Returns null when `before` is not a message of the channel.
   */
  abstract list(
    channelId: string,
    page: { before?: string; limit: number }
  ): Promise<{ messages: Message[]; hasMore: boolean } | null>;

  /**
   * Replies to a top-level message, newest first, ordered by `(createdAt, id)`. A deleted reply leaves the thread.
   * Returns null when `before` is not a reply in the thread.
   */
  abstract listReplies(
    channelId: string,
    parentId: string,
    page: { before?: string; limit: number }
  ): Promise<{ messages: Message[]; hasMore: boolean } | null>;

  abstract find(messageId: string): Promise<Message | null>;

  /**
   * Stores the message in one transaction. A message in the channel's log bumps the channel's `lastMessageAt`.
   * A reply also adds one to its root's `replyCount` and sets its `lastReplyAt`, so the channel's stream updates the root.
   * A `clientId` the author already sent returns the stored row with a null `txid`.
   */
  abstract send(input: {
    channelId: string;
    authorId: string;
    clientId: string;
    body: string;
    mentions: MessageMentions;
    /** A top-level message of the channel. The caller checks it. */
    parentId?: string;
    alsoSentToChannel?: boolean;
  }): Promise<{ message: Message; txid: string | null }>;

  /** Sets `editedAt`. */
  abstract edit(
    messageId: string,
    body: string,
    mentions: MessageMentions
  ): Promise<Message>;

  /**
   * Keeps the row so replies keep their place, and clears everything a reader could see.
   * Deleting a reply takes one off its root's `replyCount`.
   */
  abstract markDeleted(messageId: string): Promise<void>;

  /**
   * Locks the row, hands `update` its reactions, and stores the result, so two members reacting at once both land.
   * An `update` that returns null refuses the change, and this returns null without writing.
   */
  abstract updateReactions(
    messageId: string,
    update: (current: ReactionSummary) => ReactionSummary | null
  ): Promise<Message | null>;

  /** Pins as `pinnedById`, or unpins when it is null. */
  abstract setPinned(
    messageId: string,
    pinnedById: string | null
  ): Promise<Message>;

  /** Messages of the channel that are pinned, newest pin first. */
  abstract listPinned(channelId: string): Promise<Message[]>;

  /**
   * Stores the preview, or clears it when null. With `onlyIfBody`, a message that was edited or deleted
   * meanwhile is left alone. Returns null when no message matched.
   */
  abstract setLinkPreview(
    messageId: string,
    preview: LinkPreview | null,
    onlyIfBody?: string
  ): Promise<Message | null>;
}
