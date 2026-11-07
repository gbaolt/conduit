import type { Message, ParsedMentions } from '@conduit/contract';

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

  abstract find(messageId: string): Promise<Message | null>;

  /**
   * Stores the message and bumps the channel's `lastMessageAt` in one transaction.
   * A `clientId` the author already sent returns the stored row with a null `txid`.
   */
  abstract send(input: {
    channelId: string;
    authorId: string;
    clientId: string;
    body: string;
    mentions: MessageMentions;
  }): Promise<{ message: Message; txid: string | null }>;

  /** Sets `editedAt`. */
  abstract edit(
    messageId: string,
    body: string,
    mentions: MessageMentions
  ): Promise<Message>;

  /** Keeps the row so replies keep their place, and clears everything a reader could see. */
  abstract markDeleted(messageId: string): Promise<void>;
}
