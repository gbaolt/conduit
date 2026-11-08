import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { RoomsService } from '@/rooms/application/rooms.service';

@Controller()
export class RoomsController {
  constructor(
    @Inject(RoomsService) private readonly roomsService: RoomsService
  ) {}

  @Implement(contract.rooms.get)
  get() {
    return implement(contract.rooms.get)
      .use(authorized)
      .use(arcjet.read)
      .handler(({ context, input }) =>
        this.roomsService.get(context.user.id, input.roomId)
      );
  }

  @Implement(contract.rooms.members.list)
  listMembers() {
    return implement(contract.rooms.members.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.roomsService.listMembers(
          {
            userId: context.user.id,
            organizationId: context.organizationId,
            workspaceRole: context.workspaceRole,
          },
          input.roomId
        )
      );
  }
}
