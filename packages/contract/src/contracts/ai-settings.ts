import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import { organizationErrors } from '@/contracts/organizations';
import { AiSettingsSchema } from '@/schemas/ai';

export const aiErrors = {
  AI_DISABLED: {
    status: 403,
    message: 'AI is turned off for this workspace.',
  },
  AI_UNAVAILABLE: { status: 503, message: 'AI is unavailable right now.' },
} as const;

const { FORBIDDEN } = organizationErrors;

export const getAiSettingsContract = oc
  .meta(openapi({ method: 'GET', path: '/ai-settings' }))
  .output(AiSettingsSchema);

export const updateAiSettingsContract = oc
  .meta(openapi({ method: 'PATCH', path: '/ai-settings' }))
  .errors({ FORBIDDEN })
  .input(AiSettingsSchema)
  .output(AiSettingsSchema);
