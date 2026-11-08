import { z } from 'zod';

import { ChannelNameSchema } from '@/schemas/channels';

/** The most people one DM holds, the caller included. */
export const DM_MEMBERS_MAX = 10;

export const DmMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});
export type DmMember = z.infer<typeof DmMemberSchema>;

/** A direct conversation. Its `id` is a channel id, so messages, threads, and live streams treat it as any channel. */
export const DmSchema = z.object({
  id: z.string(),
  /** Everyone in it, the caller included. A DM with only the caller is the self DM. */
  members: z.array(DmMemberSchema),
  lastMessageAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type Dm = z.infer<typeof DmSchema>;

export const OpenDmInputSchema = z.object({
  /** The people to talk to. The caller is added, so an empty list opens the self DM. */
  userIds: z.array(z.string()).max(DM_MEMBERS_MAX),
});

export const AddDmPeopleInputSchema = z.object({
  channelId: z.string(),
  userIds: z.array(z.string()).min(1).max(DM_MEMBERS_MAX),
});

export const ConvertDmInputSchema = z.object({
  channelId: z.string(),
  name: ChannelNameSchema,
});

/** The viewer's DMs, most recent message first. */
export const ListDmsOutputSchema = z.array(DmSchema);
