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
      .handler(({ context }) => this.channelsService.list(viewerOf(context)));
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
}
