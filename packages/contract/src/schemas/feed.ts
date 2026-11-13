import { z } from 'zod';

import { RoomKindSchema } from '@/schemas/rooms';

/** The four things that put an item in a member's Activity. */
export const ActivityKindSchema = z.enum([
  'mention',
  'thread_reply',
  'reaction',
  'room_add',
]);
export type ActivityKind = z.infer<typeof ActivityKindSchema>;

export const FEED_PAGE_DEFAULT = 30;
export const FEED_PAGE_MAX = 100;
/** A message body in an entry is cut to this many characters. */
export const FEED_EXCERPT_MAX = 280;
export const FEED_DELETED_BODY = 'This message was deleted.';

export const FeedFilterSchema = z.enum(['all', 'unread']);
export type FeedFilter = z.infer<typeof FeedFilterSchema>;

/** One Activity item, with what a row needs to show it and link to it. */
export const FeedEntrySchema = z.object({
  id: z.string(),
  kind: ActivityKindSchema,
  room: z.object({
    id: z.string(),
    /** Empty for a DM. */
    name: z.string(),
    kind: RoomKindSchema,
  }),
  actor: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
  /** Absent for a channel add. */
  message: z
    .object({
      id: z.string(),
      parentId: z.string().nullable(),
      body: z.string(),
      deletedAt: z.coerce.date().nullable(),
    })
    .optional(),
  /** Set for a reaction. */
  emoji: z.string().optional(),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type FeedEntry = z.infer<typeof FeedEntrySchema>;

export const ListFeedInputSchema = z.object({
  filter: FeedFilterSchema,
  /** The oldest entry already loaded. The page ends just before it. */
  before: z.string().optional(),
  limit: z.number().int().min(1).max(FEED_PAGE_MAX).optional(),
});

export const ListFeedOutputSchema = z.object({
  /** Newest first. */
  entries: z.array(FeedEntrySchema),
  hasMore: z.boolean(),
});
export type ListFeedOutput = z.infer<typeof ListFeedOutputSchema>;

export const MarkFeedReadInputSchema = z.object({
  ids: z.array(z.string()).min(1).max(FEED_PAGE_MAX),
});

/** One row of the `feed` stream: an unread item in a room the caller is still in. */
export const FeedStreamRowSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  createdAt: z.coerce.date(),
});
export type FeedStreamRow = z.infer<typeof FeedStreamRowSchema>;
