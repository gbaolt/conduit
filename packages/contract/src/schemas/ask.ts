import { z } from 'zod';

import { ListedFileSchema } from '@/schemas/files';
import { MessageHitSchema } from '@/schemas/search';

export const ASK_QUESTION_MAX = 500;

export const AskInputSchema = z.object({
  /** The chat to continue. Without it the question starts a new chat. */
  chatId: z.string().optional(),
  question: z.string().trim().min(1).max(ASK_QUESTION_MAX),
});

/** What the model returns. `found` comes first, so the model decides before it writes. */
export const ModelAnswerSchema = z.object({
  found: z
    .boolean()
    .describe(
      'False when the sources do not answer the question. Then leave body empty.'
    ),
  body: z
    .string()
    .describe(
      'The answer in Markdown, citing each claim with the number of its source, as in [2].'
    ),
});
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

/** A cited source, as Postgres holds it now. */
export const AnswerSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), message: MessageHitSchema }),
  z.object({ type: z.literal('file'), file: ListedFileSchema }),
]);
export type AnswerSource = z.infer<typeof AnswerSourceSchema>;

export const AnswerSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  question: z.string(),
  /** False when the sources the asker can read don't answer the question. */
  found: z.boolean(),
  /** Markdown. Each `[n]` cites `sources[n - 1]`. */
  body: z.string(),
  sources: z.array(AnswerSourceSchema),
  createdAt: z.coerce.date(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const AskEventSchema = z.discriminatedUnion('type', [
  /** The answer so far. `found` is false once the model has said the sources don't answer. */
  z.object({
    type: z.literal('partial'),
    found: z.boolean(),
    body: z.string(),
    sources: z.array(AnswerSourceSchema),
  }),
  /** The stored answer, last. */
  z.object({ type: z.literal('done'), answer: AnswerSchema }),
]);
export type AskEvent = z.infer<typeof AskEventSchema>;

/** One row of the asker's chat history. */
export const AskChatSummarySchema = z.object({
  id: z.string(),
  /** The chat's first question. */
  title: z.string(),
  updatedAt: z.coerce.date(),
});
export type AskChatSummary = z.infer<typeof AskChatSummarySchema>;

/** A chat with its answers, oldest first. */
export const AskChatSchema = z.object({
  id: z.string(),
  title: z.string(),
  answers: z.array(AnswerSchema),
});
export type AskChat = z.infer<typeof AskChatSchema>;

export const AskChatIdInputSchema = z.object({ chatId: z.string() });
