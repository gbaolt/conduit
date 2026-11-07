import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { WorkspaceMembersService } from '@/workspaces/application/workspace-members.service';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: WorkspaceViewer['workspaceRole'];
}): WorkspaceViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

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

  @Implement(contract.members.deactivate)
  deactivate() {
    return implement(contract.members.deactivate)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.membersService.deactivate(viewerOf(context), input.memberId)
      );
  }

  @Implement(contract.members.reactivate)
  reactivate() {
    return implement(contract.members.reactivate)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.membersService.reactivate(viewerOf(context), input.memberId)
      );
  }
}
