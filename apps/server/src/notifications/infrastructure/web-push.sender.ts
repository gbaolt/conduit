import type { PushPayload } from '@conduit/contract';
import { Injectable } from '@nestjs/common';
import { sendNotification } from 'web-push';

import type {
  PushResult,
  PushSender,
  PushTarget,
} from '@/notifications/domain/push-sender.port';

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/** Sends with the `web-push` package. It needs Node's crypto, so it runs on Vercel's Node runtime and not in Workers. */
@Injectable()
export class WebPushSender implements PushSender {
  readonly enabled: boolean;

  constructor(private readonly vapid: VapidKeys | null) {
    this.enabled = vapid !== null;
  }

  async send(
    target: PushTarget,
    payload: PushPayload,
    { ttlSeconds }: { ttlSeconds: number }
  ): Promise<PushResult> {
    if (!this.vapid) throw new Error('VAPID keys are not set.');
    try {
      await sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        JSON.stringify(payload),
        { TTL: ttlSeconds, vapidDetails: this.vapid }
      );
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      throw error;
    }
  }
}

export function vapidFromEnv(env: NodeJS.ProcessEnv): VapidKeys | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
  return VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT
    ? {
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY,
        subject: VAPID_SUBJECT,
      }
    : null;
}
