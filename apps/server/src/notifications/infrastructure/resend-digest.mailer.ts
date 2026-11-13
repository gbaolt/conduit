import { Injectable } from '@nestjs/common';

import { appURL, emailFrom, resend } from '@/infrastructure/auth/resend';
import { buildDigestEmail } from '@/notifications/domain/digest-email';
import type { DigestMailer } from '@/notifications/domain/digest-mailer.port';

@Injectable()
export class ResendDigestMailer implements DigestMailer {
  async send({ to, recipient, mentions }: Parameters<DigestMailer['send']>[0]) {
    const email = buildDigestEmail({ mentions, recipient, appUrl: appURL });

    if (!resend) {
      console.log(`[digests] to=${to} subject=${email.subject}`);
      return;
    }

    // Resend returns its failure instead of throwing, and the run needs it to release the claim.
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: [to],
      ...email,
    });
    if (error) throw new Error(error.message);
  }
}
