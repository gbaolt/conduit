import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import {
  RoomsService,
  type RoomViewer,
} from '@/rooms/application/rooms.service';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: RoomViewer['workspaceRole'];
}): RoomViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

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
        this.roomsService.listMembers(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.rooms.setNotify)
  setNotify() {
    return implement(contract.rooms.setNotify)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.roomsService.setNotify(
          viewerOf(context),
          input.roomId,
          input.level
        )
      );
  }

  @Implement(contract.rooms.mute)
  mute() {
    return implement(contract.rooms.mute)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.roomsService.mute(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.rooms.unmute)
  unmute() {
    return implement(contract.rooms.unmute)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.roomsService.unmute(viewerOf(context), input.roomId)
      );
  }
}
