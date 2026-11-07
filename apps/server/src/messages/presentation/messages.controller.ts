import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import {
  MessagesService,
  type MessageViewer,
} from '@/messages/application/messages.service';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: MessageViewer['workspaceRole'];
}): MessageViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

@Controller()
export class MessagesController {
  constructor(
    @Inject(MessagesService) private readonly messagesService: MessagesService
  ) {}

  @Implement(contract.messages.list)
  list() {
    return implement(contract.messages.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.list(viewerOf(context), input)
      );
  }

  @Implement(contract.messages.send)
  send() {
    return implement(contract.messages.send)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.send(viewerOf(context), input)
      );
  }

  @Implement(contract.messages.edit)
  edit() {
    return implement(contract.messages.edit)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.edit(
          viewerOf(context),
          input.messageId,
          input.body
        )
      );
  }

  @Implement(contract.messages.delete)
  delete() {
    return implement(contract.messages.delete)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.delete(viewerOf(context), input.messageId)
      );
  }

  @Implement(contract.messages.react)
  react() {
    return implement(contract.messages.react)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.react(
          viewerOf(context),
          input.messageId,
          input.emoji
        )
      );
  }

  @Implement(contract.messages.unreact)
  unreact() {
    return implement(contract.messages.unreact)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.unreact(
          viewerOf(context),
          input.messageId,
          input.emoji
        )
      );
  }

  @Implement(contract.messages.pin)
  pin() {
    return implement(contract.messages.pin)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.pin(viewerOf(context), input.messageId)
      );
  }

  @Implement(contract.messages.unpin)
  unpin() {
    return implement(contract.messages.unpin)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.unpin(viewerOf(context), input.messageId)
      );
  }

  @Implement(contract.messages.listPinned)
  listPinned() {
    return implement(contract.messages.listPinned)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.listPinned(viewerOf(context), input.channelId)
      );
  }

  @Implement(contract.saved.add)
  save() {
    return implement(contract.saved.add)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.save(viewerOf(context), input.messageId)
      );
  }

  @Implement(contract.saved.remove)
  unsave() {
    return implement(contract.saved.remove)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.messagesService.unsave(viewerOf(context), input.messageId)
      );
  }

  @Implement(contract.saved.list)
  listSaved() {
    return implement(contract.saved.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.messagesService.listSaved(viewerOf(context))
      );
  }
}
