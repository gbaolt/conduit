import type { Thread } from '@conduit/contract';

/** Threads a member takes part in. Callers pass the rooms the member can read. */
export abstract class ThreadsRepository {
  /**
   * Threads in `roomIds` whose root the member wrote or where they wrote a live reply, newest reply first.
   * Each carries its newest `replies` live replies, oldest first, and everyone who wrote in it.
   */
  abstract list(
    userId: string,
    roomIds: string[],
    limit: { threads: number; replies: number }
  ): Promise<Thread[]>;
}
