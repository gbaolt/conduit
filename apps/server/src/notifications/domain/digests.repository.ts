import type { DigestCandidate } from './digest';

/** One member in one workspace. */
export type DigestScope = { organizationId: string; userId: string };

export abstract class DigestsRepository {
  /**
   * Members with an unread `MENTION` item and a last heartbeat before `awayBefore`, in rooms they are still in,
   * each with their unread mentions. Whether they are due, and which mentions count, is `dueMentions`'s call.
   */
  abstract candidates(awayBefore: Date): Promise<DigestCandidate[]>;

  /**
   * Atomically moves `DigestState.lastSentAt` to `now`, creating the row on first use, but only while it is
   * older than `lastActiveAt`. Returns false when another run already did, so two overlapping runs send once.
   */
  abstract claim(
    scope: DigestScope,
    lastActiveAt: Date,
    now: Date
  ): Promise<boolean>;

  /** Puts `lastSentAt` back to `previous` after a failed send, so the next run retries. Null deletes the row. */
  abstract release(
    scope: DigestScope,
    claimedAt: Date,
    previous: Date | null
  ): Promise<void>;
}
