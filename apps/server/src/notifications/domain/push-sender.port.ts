import type { PushPayload } from '@conduit/contract';

/** What the browser's push service needs to reach one browser. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** How a push ends. `gone` means the push service says the subscription no longer exists. Any other failure throws. */
export type PushResult = 'sent' | 'gone';

export abstract class PushSender {
  /** False when no VAPID keys are set, so there is nothing to send with. */
  abstract readonly enabled: boolean;

  abstract send(
    target: PushTarget,
    payload: PushPayload,
    options: { ttlSeconds: number }
  ): Promise<PushResult>;
}
