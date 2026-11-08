import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { ChannelsService } from '@/channels/application/channels.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import type { RoomViewer } from '@/rooms/application/rooms.service';

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
export class ChannelsController {
  constructor(
    @Inject(ChannelsService)
    private readonly channelsService: ChannelsService
  ) {}

  @Implement(contract.channels.list)
  list() {
    return implement(contract.channels.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.list(viewerOf(context), input?.archived)
      );
  }

  @Implement(contract.channels.create)
  create() {
    return implement(contract.channels.create)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.create(viewerOf(context), input)
      );
  }

  @Implement(contract.channels.rename)
  rename() {
    return implement(contract.channels.rename)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.rename(viewerOf(context), input.roomId, input.name)
      );
  }

  @Implement(contract.channels.delete)
  delete() {
    return implement(contract.channels.delete)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.delete(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.channels.join)
  join() {
    return implement(contract.channels.join)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.join(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.channels.leave)
  leave() {
    return implement(contract.channels.leave)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.leave(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.channels.update)
  update() {
    return implement(contract.channels.update)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input: { roomId, ...details } }) =>
        this.channelsService.update(viewerOf(context), roomId, details)
      );
  }

  @Implement(contract.channels.members.add)
  addMembers() {
    return implement(contract.channels.members.add)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.addMembers(
          viewerOf(context),
          input.roomId,
          input.userIds
        )
      );
  }

  @Implement(contract.channels.members.remove)
  removeMember() {
    return implement(contract.channels.members.remove)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.removeMember(
          viewerOf(context),
          input.roomId,
          input.userId
        )
      );
  }

  @Implement(contract.channels.members.setRole)
  setMemberRole() {
    return implement(contract.channels.members.setRole)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.setMemberRole(
          viewerOf(context),
          input.roomId,
          input.userId,
          input.role
        )
      );
  }

  @Implement(contract.channels.archive)
  archive() {
    return implement(contract.channels.archive)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.archive(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.channels.unarchive)
  unarchive() {
    return implement(contract.channels.unarchive)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.unarchive(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.channels.setVisibility)
  setVisibility() {
    return implement(contract.channels.setVisibility)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.setVisibility(
          viewerOf(context),
          input.roomId,
          input.visibility
        )
      );
  }

  @Implement(contract.channels.star)
  star() {
    return implement(contract.channels.star)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.star(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.channels.unstar)
  unstar() {
    return implement(contract.channels.unstar)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.unstar(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.channels.moveToSection)
  moveToSection() {
    return implement(contract.channels.moveToSection)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.moveToSection(
          viewerOf(context),
          input.roomId,
          input.sectionId
        )
      );
  }
}
