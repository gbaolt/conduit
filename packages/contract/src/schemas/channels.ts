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

export const CreateChannelInputSchema = z.object({
  name: ChannelNameSchema,
  visibility: ChannelVisibilitySchema.default('public'),
});

export const RenameChannelInputSchema = z.object({
  roomId: z.string(),
  name: ChannelNameSchema,
});

export const CHANNEL_TEXT_MAX = 250;

// Omit a field to keep it; null or empty clears it.
const ChannelTextSchema = z
  .string()
  .trim()
  .max(CHANNEL_TEXT_MAX, `Use ${CHANNEL_TEXT_MAX} characters or fewer.`)
  .nullable()
  .optional();

export const UpdateChannelInputSchema = z.object({
  roomId: z.string(),
  topic: ChannelTextSchema,
  description: ChannelTextSchema,
});

export const RoomMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  role: RoomRoleSchema,
  joinedAt: z.coerce.date(),
});
export type RoomMember = z.infer<typeof RoomMemberSchema>;

export const AddChannelMembersInputSchema = z.object({
  roomId: z.string(),
  userIds: z.array(z.string()).min(1).max(100),
});

export const ChannelMemberInputSchema = z.object({
  roomId: z.string(),
  userId: z.string(),
});

export const SetChannelMemberRoleInputSchema = z.object({
  roomId: z.string(),
  userId: z.string(),
  role: RoomRoleSchema,
});

export const ListChannelsInputSchema = z
  .object({ archived: z.boolean().optional() })
  .optional();

export const SetChannelVisibilityInputSchema = z.object({
  roomId: z.string(),
  visibility: ChannelVisibilitySchema,
});

export const MoveChannelToSectionInputSchema = z.object({
  roomId: z.string(),
  sectionId: z.string().nullable(),
});

export const CHANNEL_SECTION_NAME_MAX = 40;

export const ChannelSectionNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a section name.')
  .max(
    CHANNEL_SECTION_NAME_MAX,
    `Use ${CHANNEL_SECTION_NAME_MAX} characters or fewer.`
  );

export const ChannelSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int(),
});
export type ChannelSection = z.infer<typeof ChannelSectionSchema>;

export const CreateChannelSectionInputSchema = z.object({
  name: ChannelSectionNameSchema,
});

export const RenameChannelSectionInputSchema = z.object({
  sectionId: z.string(),
  name: ChannelSectionNameSchema,
});

export const ChannelSectionIdInputSchema = z.object({ sectionId: z.string() });

export const ReorderChannelSectionsInputSchema = z.object({
  sectionIds: z.array(z.string()),
});
