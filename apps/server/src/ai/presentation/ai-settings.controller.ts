import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { AiAccessService } from '@/ai/application/ai-access.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';

@Controller()
export class AiSettingsController {
  constructor(
    @Inject(AiAccessService) private readonly access: AiAccessService
  ) {}

  @Implement(contract.aiSettings.get)
  get() {
    return implement(contract.aiSettings.get)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) => this.access.get(context.organizationId));
  }

  @Implement(contract.aiSettings.update)
  update() {
    return implement(contract.aiSettings.update)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.access.update(
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
