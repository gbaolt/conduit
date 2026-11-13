import type { SubscribePushInput } from '@conduit/contract';

export abstract class PushSubscriptionsRepository {
  /** Keeps one row per `endpoint`: a second subscribe from one browser changes nothing, and another account takes the row over. */
  abstract subscribe(userId: string, input: SubscribePushInput): Promise<void>;

  /** Removes the caller's own row. Another member's endpoint changes nothing. */
  abstract unsubscribe(userId: string, endpoint: string): Promise<void>;

  /** Removes a row the push service reported gone. */
  abstract forget(endpoint: string): Promise<void>;

  abstract markDelivered(endpoints: string[], at: Date): Promise<void>;
}
