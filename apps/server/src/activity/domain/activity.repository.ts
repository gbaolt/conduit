/** A conversation, or one thread of it. `parentId` is an empty string for the conversation itself. */
export type ConversationScope = {
  roomId: string;
  userId: string;
  parentId: string;
};

/** What members are doing: reading, drafting, typing, and being online. Callers check channel access first. */
export abstract class ActivityRepository {
  /**
   * Moves the member's read position forward to the message, and never backward, so a late or repeated call
   * changes nothing. Returns false when the message is not in the channel.
   */
  abstract markRead(input: {
    roomId: string;
    userId: string;
    messageId: string;
  }): Promise<boolean>;

  /** The draft's body, or an empty string when there is none. */
  abstract getDraft(scope: ConversationScope): Promise<string>;

  /** Stores the draft, or deletes it when the body is empty. */
  abstract saveDraft(scope: ConversationScope, body: string): Promise<void>;

  abstract setTyping(scope: ConversationScope, until: Date): Promise<void>;

  abstract recordHeartbeat(input: {
    organizationId: string;
    userId: string;
    away: boolean;
    at: Date;
  }): Promise<void>;
}
