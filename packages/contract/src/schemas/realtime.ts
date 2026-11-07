import { z } from 'zod';

/** The streams a client may ask to seal. The server owns the SQL for each. */
export const LiveStreamSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('conversation'), channelId: z.string() }),
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
