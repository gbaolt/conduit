import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { arcjet } from '@/orpc/arcjet.middleware';
import { authorized } from '@/orpc/auth.middleware';
import { workspaceMember } from '@/orpc/workspace.middleware';

import { ChannelsService, type ChannelViewer } from './channels.service';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: ChannelViewer['workspaceRole'];
}): ChannelViewer {
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

  @Implement(contract.channels.get)
  get() {
    return implement(contract.channels.get)
      .use(authorized)
      .use(arcjet.read)
      .handler(({ context, input }) =>
        this.channelsService.get(context.user.id, input.channelId)
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
        this.channelsService.rename(
          viewerOf(context),
          input.channelId,
          input.name
        )
      );
  }

  @Implement(contract.channels.delete)
  delete() {
    return implement(contract.channels.delete)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.delete(viewerOf(context), input.channelId)
      );
  }

  @Implement(contract.channels.join)
  join() {
    return implement(contract.channels.join)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.join(viewerOf(context), input.channelId)
      );
  }

  @Implement(contract.channels.leave)
  leave() {
    return implement(contract.channels.leave)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.leave(viewerOf(context), input.channelId)
      );
  }

  @Implement(contract.channels.update)
  update() {
    return implement(contract.channels.update)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input: { channelId, ...details } }) =>
        this.channelsService.update(viewerOf(context), channelId, details)
      );
  }

  @Implement(contract.channels.members.list)
  listMembers() {
    return implement(contract.channels.members.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.listMembers(viewerOf(context), input.channelId)
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
          input.channelId,
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
          input.channelId,
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
          input.channelId,
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
        this.channelsService.archive(viewerOf(context), input.channelId)
      );
  }

  @Implement(contract.channels.unarchive)
  unarchive() {
    return implement(contract.channels.unarchive)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.channelsService.unarchive(viewerOf(context), input.channelId)
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
          input.channelId,
          input.visibility
        )
      );
  }
}
