import { z } from 'zod';

import { ListedFileSchema } from '@/schemas/files';
import { ChannelVisibilitySchema, RoomKindSchema } from '@/schemas/rooms';

export const SEARCH_TEXT_MAX = 500;
export const SEARCH_LIMIT_DEFAULT = 20;
export const SEARCH_LIMIT_MAX = 50;

export const SearchInputSchema = z.object({
  /** What the member typed, filters included. See `parseSearchQuery`. */
  text: z.string().trim().max(SEARCH_TEXT_MAX),
  /** The most results of each kind. */
  limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional(),
});
export type SearchInput = z.infer<typeof SearchInputSchema>;

const SearchRoomSchema = z.object({
  id: z.string(),
  /** Empty for a DM. */
  name: z.string(),
  kind: RoomKindSchema,
});

const SearchPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});

/** A message as Postgres holds it now, never as the index last saw it. */
export const MessageHitSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  body: z.string(),
  room: SearchRoomSchema,
  author: SearchPersonSchema,
  createdAt: z.coerce.date(),
});
export type MessageHit = z.infer<typeof MessageHitSchema>;

export const ChannelHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  topic: z.string().nullable(),
  visibility: ChannelVisibilitySchema,
  memberCount: z.number().int(),
  /** False for a public channel the caller can read but hasn't joined. */
  joined: z.boolean(),
});
export type ChannelHit = z.infer<typeof ChannelHitSchema>;

export const PersonHitSchema = SearchPersonSchema.extend({
  email: z.string(),
});
export type PersonHit = z.infer<typeof PersonHitSchema>;

export const SearchOutputSchema = z.object({
  /** Best match first, or newest first when the query is filters alone. */
  messages: z.array(MessageHitSchema),
  files: z.array(ListedFileSchema),
  channels: z.array(ChannelHitSchema),
  people: z.array(PersonHitSchema),
  /** False when the index could not be reached, so messages and files may be missing. */
  indexed: z.boolean(),
});
export type SearchOutput = z.infer<typeof SearchOutputSchema>;
