import {
  effectiveNotify,
  isDndActive,
  type Message,
  presenceStatus,
  type PushPayload,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { notificationFor } from '@/notifications/domain/notification-rule';
import { PushAudienceRepository } from '@/notifications/domain/push-audience.repository';
import { pushPayloadFor } from '@/notifications/domain/push-payload';
import {
  PushSender,
  type PushTarget,
} from '@/notifications/domain/push-sender.port';
import { PushSubscriptionsRepository } from '@/notifications/domain/push-subscriptions.repository';

const PUSH_TTL_SECONDS = 60 * 60;

@Injectable()
export class PushNotificationsService {
  constructor(
    @Inject(PushAudienceRepository)
    private readonly audiences: PushAudienceRepository,
    @Inject(PushSubscriptionsRepository)
    private readonly subscriptions: PushSubscriptionsRepository,
    @Inject(PushSender) private readonly sender: PushSender
  ) {}

  /**
   * Pushes a sent message to each member `notificationFor` allows, once per browser. Runs after the send
   * commits and never fails: a push that goes missing leaves the message in the app.
   */
  async dispatchMessage(message: Message) {
    if (!this.sender.enabled || message.deletedAt) return;

    try {
      const audience = await this.audiences.audienceFor(message);
      if (!audience) return;

      const now = new Date();
      const hearing = audience.recipients.filter((recipient) =>
        notificationFor(
          {
            level: effectiveNotify(audience.room.kind, recipient.notify),
            muted: recipient.muted,
            dnd: isDndActive(recipient.settings, now),
            online:
              presenceStatus(recipient.presence, now.getTime()) === 'online',
          },
          recipient.itemKind ?? 'message',
          'push'
        )
      );
      if (hearing.length === 0) return;

      const payload = pushPayloadFor(message, audience);
      const delivered = await Promise.all(
        hearing
          .flatMap(({ targets }) => targets)
          .map((target) => this.deliver(target, payload))
      );
      await this.subscriptions.markDelivered(
        delivered.filter((endpoint) => endpoint !== null),
        now
      );
    } catch (error) {
      console.error('Push dispatch failed', error);
    }
  }

  /** The endpoint when the push went out, so the caller can stamp it. A gone subscription is deleted. */
  private async deliver(target: PushTarget, payload: PushPayload) {
    try {
      const result = await this.sender.send(target, payload, {
        ttlSeconds: PUSH_TTL_SECONDS,
      });
      if (result === 'gone') {
        await this.subscriptions.forget(target.endpoint);
        return null;
      }
      return target.endpoint;
    } catch (error) {
      console.error('Push send failed', error);
      return null;
    }
  }
}
