import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { translateStreamErrors } from '@/infrastructure/orpc/errors';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import type { MessageViewer } from '@/messages/application/messages.service';
import { SummariesService } from '@/summaries/application/summaries.service';

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
export class SummariesController {
  constructor(
    @Inject(SummariesService)
    private readonly summariesService: SummariesService
  ) {}

  @Implement(contract.summaries.thread)
  thread() {
    return implement(contract.summaries.thread)
      .use(authorized)
      .use(workspaceMember)
      .use(arcjet.heavyWriteByWorkspace)
      .handler(async ({ context, input, signal }) =>
        translateStreamErrors(
          await this.summariesService.summarizeThread(
            viewerOf(context),
            input.messageId,
            signal
          )
        )
      );
  }

  @Implement(contract.summaries.channel)
  channel() {
    return implement(contract.summaries.channel)
      .use(authorized)
      .use(workspaceMember)
      .use(arcjet.heavyWriteByWorkspace)
      .handler(async ({ context, input, signal }) =>
        translateStreamErrors(
          await this.summariesService.summarizeChannel(
            viewerOf(context),
            input,
            signal
          )
        )
      );
  }

  @Implement(contract.summaries.get)
  get() {
    return implement(contract.summaries.get)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.summariesService.get(viewerOf(context), input.summaryId)
      );
  }

  @Implement(contract.summaries.share)
  share() {
    return implement(contract.summaries.share)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.summariesService.share(viewerOf(context), input.summaryId)
      );
  }
}
