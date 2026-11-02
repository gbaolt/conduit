import { z } from 'zod';

import {
  CHANNEL_NAME_MAX,
  hasNonLatinLetters,
  toChannelName,
} from '@/lib/names';

export const ChannelVisibilitySchema = z.enum(['public', 'private']);
export type ChannelVisibility = z.infer<typeof ChannelVisibilitySchema>;

export const ChannelRoleSchema = z.enum(['manager', 'member']);
export type ChannelRole = z.infer<typeof ChannelRoleSchema>;

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

export const ChannelSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
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
      role: ChannelRoleSchema,
      starredAt: z.coerce.date().nullable(),
      sectionId: z.string().nullable(),
    })
    .nullable(),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelIdInputSchema = z.object({ channelId: z.string() });

export const CreateChannelInputSchema = z.object({
  name: ChannelNameSchema,
  visibility: ChannelVisibilitySchema.default('public'),
});

export const RenameChannelInputSchema = z.object({
  channelId: z.string(),
  name: ChannelNameSchema,
});
