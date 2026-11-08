import { z } from 'zod';

/** The most messages one summary reads. A longer range keeps the newest. */
export const SUMMARY_MESSAGES_MAX = 200;

export const SummaryBulletSchema = z.object({
  text: z
    .string()
    .describe('One or two sentences about what was said, decided, or asked.'),
  sourceIds: z
    .array(z.string())
    .describe(
      'The labels of the messages that support this bullet, such as "m3".'
    ),
});
export type SummaryBullet = z.infer<typeof SummaryBulletSchema>;

/** What the model returns. */
export const ModelSummarySchema = z.object({
  bullets: z.array(SummaryBulletSchema),
});
export type ModelSummary = z.infer<typeof ModelSummarySchema>;

/** A summary as its requester sees it. A source id is the id of a message the model read. */
export const SummarySchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** The thread's root message, or null for a channel summary. */
  parentId: z.string().nullable(),
  from: z.coerce.date().nullable(),
  to: z.coerce.date().nullable(),
  /** How many messages the model read. */
  messageCount: z.number().int(),
  bullets: z.array(SummaryBulletSchema),
  /** The cited messages in order of first citation. A source link shows its position in this list. */
  sourceMessageIds: z.array(z.string()),
  /** The message that shared this summary, once the requester shared it. */
  sharedMessageId: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type Summary = z.infer<typeof SummarySchema>;

export const SummaryEventSchema = z.discriminatedUnion('type', [
  /** The bullets so far. Each one already cites only messages the model read. */
  z.object({
    type: z.literal('partial'),
    messageCount: z.number().int(),
    bullets: z.array(SummaryBulletSchema),
  }),
  /** The stored summary, last. */
  z.object({ type: z.literal('done'), summary: SummarySchema }),
]);
export type SummaryEvent = z.infer<typeof SummaryEventSchema>;

export const ThreadSummaryInputSchema = z.object({
  /** The thread's root message. */
  messageId: z.string(),
});

export const ChannelSummaryInputSchema = z
  .object({
    roomId: z.string(),
    /** Summarizes the channel's log from this time. */
    from: z.iso.datetime(),
    /** Until just before this time, or until now when left out. */
    to: z.iso.datetime().optional(),
  })
  .refine(({ from, to }) => !to || new Date(to) > new Date(from), {
    message: 'The end must come after the start.',
    path: ['to'],
  });

export const SummaryIdInputSchema = z.object({ summaryId: z.string() });
