import { z } from 'zod';

import { ASK_ATTACHMENTS_MAX } from '@/lib/ask-attachments';

import {
  CompleteFileInputSchema,
  FileUploadInputSchema,
  ListedFileSchema,
  MessageFileSchema,
} from '@/schemas/files';
import { MessageHitSchema } from '@/schemas/search';

export const ASK_QUESTION_MAX = 500;

export const AskInputSchema = z.object({
  /** The chat to continue. Without it the question starts a new chat. */
  chatId: z.string().optional(),
  question: z.string().trim().min(1).max(ASK_QUESTION_MAX),
  /** Files from `ask.attachmentUrl`, uploaded and completed, that no question has carried yet. */
  attachmentIds: z.array(z.string()).max(ASK_ATTACHMENTS_MAX).default([]),
});

export const AskAttachmentUploadInputSchema = FileUploadInputSchema.omit({
  roomId: true,
});

export const AskAttachmentUploadSchema = z.object({
  attachmentId: z.string(),
  /** Presigned PUT URL. Send the file with the same `Content-Type` and size. */
  uploadUrl: z.string(),
});

export const CompleteAskAttachmentInputSchema = CompleteFileInputSchema.omit({
  fileId: true,
}).extend({ attachmentId: z.string() });

/** A file the asker attached to a question. Only the asker ever sees it. */
export const AskAttachmentSchema = MessageFileSchema.extend({
  /** Shows the file in place for 10 minutes. */
  url: z.string(),
});
export type AskAttachment = z.infer<typeof AskAttachmentSchema>;

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

/** A channel the asker can open, as Ask Conduit read it. Never a DM. */
export const AskChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  topic: z.string().nullable(),
});
export type AskChannel = z.infer<typeof AskChannelSchema>;

/** A workspace member, as Ask Conduit read them. No email: Ask Conduit never sees one. */
export const AskPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});
export type AskPerson = z.infer<typeof AskPersonSchema>;

/** One of the asker's own unsent drafts, in a channel or one of its threads. */
export const AskDraftSchema = z.object({
  room: AskChannelSchema.pick({ id: true, name: true }),
  /** The thread root, or null for the channel itself. */
  parentId: z.string().nullable(),
  body: z.string(),
  updatedAt: z.coerce.date(),
});
export type AskDraft = z.infer<typeof AskDraftSchema>;

/** A cited source, as Postgres holds it now. */
export const AnswerSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), message: MessageHitSchema }),
  z.object({ type: z.literal('file'), file: ListedFileSchema }),
  z.object({ type: z.literal('channel'), channel: AskChannelSchema }),
  z.object({ type: z.literal('person'), person: AskPersonSchema }),
  z.object({ type: z.literal('draft'), draft: AskDraftSchema }),
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
  /** What the question carried, in the order it was attached. */
  attachments: z.array(AskAttachmentSchema),
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
