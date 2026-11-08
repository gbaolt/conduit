import { z } from 'zod';

/** The streams a client may ask to seal. The server owns the SQL for each. */
export const LiveStreamSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('conversation'),
    channelId: z.string(),
    /** Rows changed at or after this time arrive live. Fixed for a subscription, so a renewal seals the same query. */
    since: z.coerce.date(),
  }),
  z.object({
    kind: z.literal('thread'),
    channelId: z.string(),
    /** The thread's root. The stream carries the root and its replies. */
    parentId: z.string(),
    since: z.coerce.date(),
  }),
  /** Who is typing in a conversation, other than the caller. Rows from `since` on arrive live. */
  z.object({
    kind: z.literal('typing'),
    channelId: z.string(),
    since: z.coerce.date(),
  }),
  /** The caller's conversations with their read state and drafts. */
  z.object({ kind: z.literal('sidebar') }),
  /** Every member of the workspace with their last heartbeat. */
  z.object({ kind: z.literal('presence') }),
]);
export type LiveStream = z.infer<typeof LiveStreamSchema>;

export const SealInputSchema = z.object({ stream: LiveStreamSchema });

export const SealedStreamSchema = z.object({
  capability: z.string(),
  queryFingerprint: z.string(),
  /** Unix milliseconds. */
  expiresAt: z.number(),
  /** The Realtime WebSocket endpoint. */
  url: z.string(),
});
export type SealedStream = z.infer<typeof SealedStreamSchema>;
