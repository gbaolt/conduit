import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { waitUntil } from '@vercel/functions';

import { AskService } from '@/ask/application/ask.service';
import { AskAttachmentsService } from '@/ask/application/ask-attachments.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { translateStreamErrors } from '@/infrastructure/orpc/errors';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import type { SearchViewer } from '@/search/application/search.service';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: SearchViewer['workspaceRole'];
}): SearchViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

@Controller()
export class AskController {
  constructor(
    @Inject(AskService) private readonly ask: AskService,
    @Inject(AskAttachmentsService)
    private readonly attachments: AskAttachmentsService
  ) {}

  @Implement(contract.ask.question)
  question() {
    return implement(contract.ask.question)
      .use(authorized)
      .use(workspaceMember)
      .use(arcjet.heavyWriteByWorkspace)
      .handler(async ({ context, input }) => {
        const run = await this.ask.question(viewerOf(context), input);
        waitUntil(run.settled);
        return translateStreamErrors(run.events);
      });
  }

  @Implement(contract.ask.chats)
  chats() {
    return implement(contract.ask.chats)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) => this.ask.chats(viewerOf(context)));
  }

  @Implement(contract.ask.chat)
  chat() {
    return implement(contract.ask.chat)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.ask.chat(viewerOf(context), input.chatId)
      );
  }

  @Implement(contract.ask.guide)
  guide() {
    return implement(contract.ask.guide)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.ask.guide(viewerOf(context), input.slug)
      );
  }

  @Implement(contract.ask.deleteChat)
  deleteChat() {
    return implement(contract.ask.deleteChat)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.ask.deleteChat(viewerOf(context), input.chatId)
      );
  }

  @Implement(contract.ask.attachmentUrl)
  attachmentUrl() {
    return implement(contract.ask.attachmentUrl)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.attachments.uploadUrl(viewerOf(context), input)
      );
  }

  @Implement(contract.ask.attachFile)
  attachFile() {
    return implement(contract.ask.attachFile)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.attachments.attachFile(viewerOf(context), input.fileId)
      );
  }

  @Implement(contract.ask.completeAttachment)
  completeAttachment() {
    return implement(contract.ask.completeAttachment)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.attachments.complete(viewerOf(context), input)
      );
  }
}
