import type { SavedMessage } from '@conduit/contract';

/** The messages a member bookmarked. Callers check that the member can still read each one. */
export abstract class SavedMessagesRepository {
  /** Does nothing when the message is already saved. */
  abstract add(userId: string, messageId: string): Promise<void>;

  abstract remove(userId: string, messageId: string): Promise<void>;

  /** Newest saved first, limited to messages in `roomIds` and not deleted. */
  abstract list(
    userId: string,
    roomIds: string[],
    limit: number
  ): Promise<SavedMessage[]>;
}
