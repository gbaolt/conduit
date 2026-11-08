import { z } from 'zod';

import { MessageBodySchema } from '@/lib/message-body';

/** `Record<emoji, userId[]>`. */
export const ReactionSummarySchema = z.record(z.string(), z.array(z.string()));
export type ReactionSummary = z.infer<typeof ReactionSummarySchema>;

/** What the page behind the first link in a message says about itself, fetched after the message is sent. */
export const LinkPreviewSchema = z.object({
  url: z.string(),
  siteName: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  /** An absolute http or https URL. */
  image: z.string().nullable(),
});
export type LinkPreview = z.infer<typeof LinkPreviewSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  clientId: z.string(),
  parentId: z.string().nullable(),
  alsoSentToChannel: z.boolean(),
  body: z.string(),
  mentionedUserIds: z.array(z.string()),
  mentionsChannel: z.boolean(),
  mentionsHere: z.boolean(),
  reactions: ReactionSummarySchema,
  replyCount: z.number().int(),
  lastReplyAt: z.coerce.date().nullable(),
  linkPreview: LinkPreviewSchema.nullable(),
  pinnedAt: z.coerce.date().nullable(),
  pinnedById: z.string().nullable(),
  editedAt: z.coerce.date().nullable(),
  deletedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Message = z.infer<typeof MessageSchema>;

export const MESSAGE_PAGE_MAX = 100;
export const MESSAGE_PAGE_DEFAULT = 50;

export const ListMessagesInputSchema = z.object({
  channelId: z.string(),
  /** The oldest message already loaded. The page ends just before it. */
  before: z.string().optional(),
  limit: z.number().int().min(1).max(MESSAGE_PAGE_MAX).optional(),
});

export const ListMessagesOutputSchema = z.object({
  /** Newest first. */
  messages: z.array(MessageSchema),
  hasMore: z.boolean(),
});
export type ListMessagesOutput = z.infer<typeof ListMessagesOutputSchema>;

export const SendMessageInputSchema = z.object({
  channelId: z.string(),
  /** Chosen by the client for each new message, so a retry cannot post it twice. */
  clientId: z.string().min(1).max(64),
  body: MessageBodySchema,
  /** A top-level message of the channel to reply to. Omit it for a message in the channel itself. */
  parentId: z.string().optional(),
  /** Also shows the reply in the channel's log. Ignored without `parentId`. */
  alsoSentToChannel: z.boolean().optional(),
});

export const SendMessageOutputSchema = z.object({
  message: MessageSchema,
  /** The Postgres transaction that stored the message, or null when `clientId` was already stored. */
  txid: z.string().nullable(),
});
export type SendMessageOutput = z.infer<typeof SendMessageOutputSchema>;

export const ListRepliesInputSchema = z.object({
  /** The top-level message whose thread to list. */
  messageId: z.string(),
  /** The oldest reply already loaded. The page ends just before it. */
  before: z.string().optional(),
  limit: z.number().int().min(1).max(MESSAGE_PAGE_MAX).optional(),
});

export const EditMessageInputSchema = z.object({
  messageId: z.string(),
  body: MessageBodySchema,
});

export const MessageIdInputSchema = z.object({ messageId: z.string() });

export const ReactionInputSchema = z.object({
  messageId: z.string(),
  emoji: z
    .string()
    .min(1)
    .max(32)
    .refine(
      (emoji) => /\p{Extended_Pictographic}/u.test(emoji),
      'Pick an emoji.'
    ),
});

export const UnreactInputSchema = z.object({
  messageId: z.string(),
  emoji: z.string().min(1).max(32),
});

export const ListPinnedInputSchema = z.object({ channelId: z.string() });

/** Newest pin first. */
export const ListPinnedOutputSchema = z.array(MessageSchema);

export const SavedMessageSchema = z.object({
  message: MessageSchema,
  /** Null for a conversation with no name, such as a DM. */
  channelName: z.string().nullable(),
  savedAt: z.coerce.date(),
});
export type SavedMessage = z.infer<typeof SavedMessageSchema>;

export const SAVED_MESSAGES_MAX = 200;

/** Newest saved first, at most `SAVED_MESSAGES_MAX`. */
export const ListSavedOutputSchema = z.array(SavedMessageSchema);
