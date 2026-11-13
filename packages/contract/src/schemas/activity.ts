import { z } from 'zod';

import { MESSAGE_BODY_MAX } from '@/lib/message-body';

export const MarkReadInputSchema = z.object({
  roomId: z.string(),
  /** The newest message the member has seen. */
  messageId: z.string(),
});

/** A conversation, or one thread of it when `parentId` is set. */
export const ConversationKeySchema = z.object({
  roomId: z.string(),
  parentId: z.string().optional(),
});

export const DraftSchema = z.object({ body: z.string() });
export type Draft = z.infer<typeof DraftSchema>;

/** An empty body deletes the draft. */
export const SaveDraftInputSchema = ConversationKeySchema.extend({
  body: z.string().max(MESSAGE_BODY_MAX),
});

export const HeartbeatInputSchema = z.object({
  /** True when the tab is hidden. */
  away: z.boolean(),
});

/** One row of the `sidebar` stream: the caller's view of a conversation they belong to. */
export const SidebarEntrySchema = z.object({
  roomId: z.string(),
  lastMessageAt: z.coerce.date().nullable(),
  /** When the caller joined. A conversation with no read state counts as read up to here. */
  joinedAt: z.coerce.date(),
  lastReadAt: z.coerce.date().nullable(),
  /** Whether the caller has an unsent message in the conversation itself, not in a thread. */
  hasDraft: z.boolean(),
  /** Set while the caller has the conversation muted. */
  mutedAt: z.coerce.date().nullable(),
});
export type SidebarEntry = z.infer<typeof SidebarEntrySchema>;

/** One row of the `typing` stream. `parentId` is empty for the channel itself. */
export const TypingRowSchema = z.object({
  userId: z.string(),
  parentId: z.string(),
  until: z.coerce.date(),
});
export type TypingRow = z.infer<typeof TypingRowSchema>;

/** One row of the `presence` stream. */
export const PresenceRowSchema = z.object({
  userId: z.string(),
  lastActiveAt: z.coerce.date(),
  away: z.boolean(),
});
export type PresenceRow = z.infer<typeof PresenceRowSchema>;
