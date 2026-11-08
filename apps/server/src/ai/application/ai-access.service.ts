import { type AiSettings, canWorkspace } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { aiError } from '@/ai/domain/ai-errors';
import { AiSettingsRepository } from '@/ai/domain/ai-settings.repository';
import { organizationError } from '@/organizations/domain/organization-errors';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

/** Whether a workspace lets its members use AI. Every AI feature asks here before it reaches the model. */
@Injectable()
export class AiAccessService {
  constructor(
    @Inject(AiSettingsRepository)
    private readonly settings: AiSettingsRepository
  ) {}

  get(organizationId: string) {
    return this.settings.get(organizationId);
  }

  async assertEnabled(organizationId: string) {
    const { aiEnabled } = await this.settings.get(organizationId);
    if (!aiEnabled) {
      throw aiError('AI_DISABLED');
    }
  }

  update(viewer: WorkspaceViewer, settings: AiSettings) {
    if (!canWorkspace('editPermissions', viewer.workspaceRole)) {
      throw organizationError('FORBIDDEN');
    }
    return this.settings.set(viewer.organizationId, settings);
  }
}
