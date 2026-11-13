import type { UpdateNotificationSettingsInput } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { NotificationSettingsRepository } from '@/notifications/domain/notification-settings.repository';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

/** A member's own notification settings. The viewer is the only scope, so nobody reads or writes another member's. */
@Injectable()
export class NotificationSettingsService {
  constructor(
    @Inject(NotificationSettingsRepository)
    private readonly settings: NotificationSettingsRepository
  ) {}

  get(viewer: WorkspaceViewer) {
    return this.settings.get(scopeOf(viewer));
  }

  update(viewer: WorkspaceViewer, patch: UpdateNotificationSettingsInput) {
    return this.settings.update(scopeOf(viewer), patch);
  }
}

const scopeOf = ({ organizationId, userId }: WorkspaceViewer) => ({
  organizationId,
  userId,
});
