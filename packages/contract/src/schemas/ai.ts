import { z } from 'zod';

export const AiSettingsSchema = z.object({
  /** Whether members can use AI features such as summaries. */
  aiEnabled: z.boolean(),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

/** What a workspace with no settings row gets. */
export const DEFAULT_AI_SETTINGS: AiSettings = { aiEnabled: true };
