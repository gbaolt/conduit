import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import { organizationErrors } from '@/contracts/organizations';
import {
  UpdateWorkspaceSettingsInputSchema,
  WorkspaceSettingsSchema,
} from '@/schemas/workspace-settings';

const { FORBIDDEN } = organizationErrors;

export const getWorkspaceSettingsContract = oc
  .meta(openapi({ method: 'GET', path: '/workspace-settings' }))
  .output(WorkspaceSettingsSchema);

export const updateWorkspaceSettingsContract = oc
  .meta(openapi({ method: 'PATCH', path: '/workspace-settings' }))
  .errors({ FORBIDDEN })
  .input(UpdateWorkspaceSettingsInputSchema)
  .output(WorkspaceSettingsSchema);
