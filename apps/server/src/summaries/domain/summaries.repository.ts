import type { Summary, SummaryBullet } from '@conduit/contract';

/** A summary with the fields that decide who may read it. */
export type StoredSummary = Summary & {
  organizationId: string;
  requesterId: string;
};

/** Summaries and the author names the model reads. Callers check access first. */
export abstract class SummariesRepository {
  abstract create(input: {
    organizationId: string;
    requesterId: string;
    roomId: string;
    parentId: string | null;
    from: Date | null;
    to: Date;
    messageCount: number;
    /** Every source id is a message the model read. */
    bullets: SummaryBullet[];
    sourceMessageIds: string[];
  }): Promise<StoredSummary>;

  abstract find(summaryId: string): Promise<StoredSummary | null>;

  /** Records the message that shared the summary. */
  abstract setShared(
    summaryId: string,
    messageId: string
  ): Promise<StoredSummary>;

  /** Display names by user id. A user who no longer exists has no entry. */
  abstract userNames(userIds: string[]): Promise<Map<string, string>>;
}
