import { Inject, Injectable } from '@nestjs/common';

import { DIGEST_AWAY_MS, dueMentions } from '@/notifications/domain/digest';
import { DigestMailer } from '@/notifications/domain/digest-mailer.port';
import { DigestsRepository } from '@/notifications/domain/digests.repository';

@Injectable()
export class DigestsService {
  constructor(
    @Inject(DigestsRepository) private readonly digests: DigestsRepository,
    @Inject(DigestMailer) private readonly mailer: DigestMailer
  ) {}

  /**
   * Emails every due member once and returns how many were sent. Each member is claimed before the send, so
   * an overlapping or repeated run skips them. A failed send releases the claim, so the next run retries.
   */
  async sendDigests(now: Date) {
    const candidates = await this.digests.candidates(
      new Date(now.getTime() - DIGEST_AWAY_MS)
    );
    let sent = 0;

    for (const candidate of candidates) {
      const mentions = dueMentions(candidate, now);
      const { lastActiveAt, lastSentAt, organizationId, userId } = candidate;
      if (!mentions.length || !lastActiveAt) continue;

      const scope = { organizationId, userId };
      if (!(await this.digests.claim(scope, lastActiveAt, now))) continue;

      try {
        await this.mailer.send({
          to: candidate.email,
          recipient: { userId, name: candidate.name },
          mentions,
        });
        sent += 1;
      } catch (error) {
        console.error('[digests] send failed', error);
        await this.digests.release(scope, now, lastSentAt);
      }
    }

    return sent;
  }
}
