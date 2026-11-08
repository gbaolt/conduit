import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { RealtimeService } from '@/realtime/application/realtime.service';

@Controller()
export class RealtimeController {
  constructor(
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService
  ) {}

  @Implement(contract.realtime.seal)
  seal() {
    return implement(contract.realtime.seal)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.realtimeService.seal(
          {
            userId: context.user.id,
            organizationId: context.organizationId,
            workspaceRole: context.workspaceRole,
          },
          input.stream
        )
      );
  }
}
