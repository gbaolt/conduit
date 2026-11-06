import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { WorkspaceSettingsService } from '@/workspaces/application/workspace-settings.service';

@Controller()
export class WorkspaceSettingsController {
  constructor(
    @Inject(WorkspaceSettingsService)
    private readonly settingsService: WorkspaceSettingsService
  ) {}

  @Implement(contract.workspaceSettings.get)
  get() {
    return implement(contract.workspaceSettings.get)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.settingsService.get(context.organizationId)
      );
  }

  @Implement(contract.workspaceSettings.update)
  update() {
    return implement(contract.workspaceSettings.update)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.settingsService.update(
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
