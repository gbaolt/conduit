import type { DigestMention } from './digest';

/** Emails one member their digest. Rejects when the mail provider refuses, so the run can retry the member. */
export abstract class DigestMailer {
  abstract send(digest: {
    to: string;
    recipient: { userId: string; name: string };
    mentions: DigestMention[];
  }): Promise<void>;
}
