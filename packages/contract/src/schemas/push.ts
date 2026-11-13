import { z } from 'zod';

/** What `PushSubscription.toJSON()` gives the page: the push service's address and the keys that encrypt to this browser. */
export const SubscribePushInputSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});
export type SubscribePushInput = z.infer<typeof SubscribePushInputSchema>;

export const UnsubscribePushInputSchema = z.object({
  endpoint: z.url().max(2048),
});

/** What the service worker shows. `tag` is the room id, so a burst in one room replaces one notification. */
export const PushPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  url: z.string(),
  tag: z.string(),
});
export type PushPayload = z.infer<typeof PushPayloadSchema>;
