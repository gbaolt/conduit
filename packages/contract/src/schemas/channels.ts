import { z } from 'zod';

import {
  ChannelNameSchema,
  ChannelVisibilitySchema,
  RoomRoleSchema,
} from '@/schemas/rooms';

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
