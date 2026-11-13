import type { SubscribePushInput } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { PushSubscriptionsRepository } from '@/notifications/domain/push-subscriptions.repository';

/** A member's own browsers. The caller's id is the only scope. */
@Injectable()
export class PushSubscriptionsService {
  constructor(
    @Inject(PushSubscriptionsRepository)
    private readonly subscriptions: PushSubscriptionsRepository
  ) {}

  subscribe(userId: string, input: SubscribePushInput) {
    return this.subscriptions.subscribe(userId, input);
  }

  unsubscribe(userId: string, endpoint: string) {
    return this.subscriptions.unsubscribe(userId, endpoint);
  }
}
