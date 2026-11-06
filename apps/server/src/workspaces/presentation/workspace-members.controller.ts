import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { WorkspaceMembersService } from '@/workspaces/application/workspace-members.service';

@Controller()
export class WorkspaceMembersController {
  constructor(
    @Inject(WorkspaceMembersService)
    private readonly membersService: WorkspaceMembersService
  ) {}

  @Implement(contract.members.list)
  list() {
    return implement(contract.members.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.membersService.list(context.organizationId)
      );
  }
}
