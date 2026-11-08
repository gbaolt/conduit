import { z } from 'zod';

import {
  CHANNEL_NAME_MAX,
  hasNonLatinLetters,
  toChannelName,
} from '@/lib/names';

export const ChannelVisibilitySchema = z.enum(['public', 'private']);
export type ChannelVisibility = z.infer<typeof ChannelVisibilitySchema>;

export const RoomRoleSchema = z.enum(['manager', 'member']);
export type RoomRole = z.infer<typeof RoomRoleSchema>;

export const ChannelNameSchema = z
  .string()
  .min(1, 'Enter a channel name.')
  .max(CHANNEL_NAME_MAX, `Use ${CHANNEL_NAME_MAX} characters or fewer.`)
  .refine(
    (name) => !hasNonLatinLetters(name),
    'Use Latin letters. Accents are fine.'
  )
  .refine(
    (name) => name === toChannelName(name),
    'Use lowercase letters, numbers, hyphens, and underscores.'
  );

/** A room is a channel or a DM. A DM has no name, no managers, and members chosen when it opens. */
export const RoomKindSchema = z.enum(['channel', 'dm']);
export type RoomKind = z.infer<typeof RoomKindSchema>;

export const RoomSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  kind: RoomKindSchema,
  /** Empty for a DM. */
  name: z.string(),
  topic: z.string().nullable(),
  description: z.string().nullable(),
  visibility: ChannelVisibilitySchema,
  isDefault: z.boolean(),
  archivedAt: z.coerce.date().nullable(),
  memberCount: z.number().int(),
  createdById: z.string().nullable(),
  createdAt: z.coerce.date(),
  membership: z
    .object({
      role: RoomRoleSchema,
      starredAt: z.coerce.date().nullable(),
      sectionId: z.string().nullable(),
    })
    .nullable(),
  archivedByName: z.string().nullable(),
});
export type Room = z.infer<typeof RoomSchema>;

export const RoomIdInputSchema = z.object({ roomId: z.string() });

export const RoomMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  role: RoomRoleSchema,
  joinedAt: z.coerce.date(),
});
export type RoomMember = z.infer<typeof RoomMemberSchema>;
