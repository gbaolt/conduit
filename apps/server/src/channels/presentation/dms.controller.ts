import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { DmsService, type DmViewer } from '@/channels/application/dms.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: DmViewer['workspaceRole'];
}): DmViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

@Controller()
export class DmsController {
  constructor(@Inject(DmsService) private readonly dmsService: DmsService) {}

  @Implement(contract.dms.list)
  list() {
    return implement(contract.dms.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) => this.dmsService.list(viewerOf(context)));
  }

  @Implement(contract.dms.open)
  open() {
    return implement(contract.dms.open)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.dmsService.open(viewerOf(context), input.userIds)
      );
  }

  @Implement(contract.dms.addPeople)
  addPeople() {
    return implement(contract.dms.addPeople)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.dmsService.addPeople(
          viewerOf(context),
          input.roomId,
          input.userIds
        )
      );
  }

  @Implement(contract.dms.convertToChannel)
  convertToChannel() {
    return implement(contract.dms.convertToChannel)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.dmsService.convertToChannel(
          viewerOf(context),
          input.roomId,
          input.name
        )
      );
  }
}
