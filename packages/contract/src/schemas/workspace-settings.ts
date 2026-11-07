import { z } from 'zod';

export const ChannelCreatorsSchema = z.enum(['everyone', 'admins']);
export type ChannelCreators = z.infer<typeof ChannelCreatorsSchema>;

export const WorkspaceSettingsSchema = z.object({
  /** Who can create any channel. */
  channelCreators: ChannelCreatorsSchema,
  /** Who can create a public channel, once `channelCreators` lets them create channels. */
  publicChannelCreators: ChannelCreatorsSchema,
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

/** What a workspace with no settings row gets. */
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  channelCreators: 'everyone',
  publicChannelCreators: 'everyone',
};

export const UpdateWorkspaceSettingsInputSchema =
  WorkspaceSettingsSchema.partial();
export type UpdateWorkspaceSettingsInput = z.infer<
  typeof UpdateWorkspaceSettingsInputSchema
>;
