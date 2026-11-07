import {
  canWorkspace,
  type UpdateWorkspaceSettingsInput,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { organizationError } from '@/organizations/domain/organization-errors';
import { WorkspaceSettingsRepository } from '@/workspaces/domain/workspace-settings.repository';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

@Injectable()
export class WorkspaceSettingsService {
  constructor(
    @Inject(WorkspaceSettingsRepository)
    private readonly settings: WorkspaceSettingsRepository
  ) {}

  get(organizationId: string) {
    return this.settings.get(organizationId);
  }

  update(viewer: WorkspaceViewer, input: UpdateWorkspaceSettingsInput) {
    if (!canWorkspace('editPermissions', viewer.workspaceRole)) {
      throw organizationError('FORBIDDEN');
    }
    return this.settings.update(viewer.organizationId, input);
  }
}
