import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { NotificationSettingsService } from '@/notifications/application/notification-settings.service';

@Controller()
export class NotificationSettingsController {
  constructor(
    @Inject(NotificationSettingsService)
    private readonly settings: NotificationSettingsService
  ) {}

  @Implement(contract.notificationSettings.get)
  get() {
    return implement(contract.notificationSettings.get)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.settings.get({
          userId: context.user.id,
          organizationId: context.organizationId,
          workspaceRole: context.workspaceRole,
        })
      );
  }

  @Implement(contract.notificationSettings.update)
  update() {
    return implement(contract.notificationSettings.update)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.settings.update(
          {
            userId: context.user.id,
            organizationId: context.organizationId,
            workspaceRole: context.workspaceRole,
          },
          input
        )
      );
  }
}
