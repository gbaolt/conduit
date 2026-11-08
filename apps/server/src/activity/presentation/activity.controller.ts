import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import {
  ActivityService,
  type ActivityViewer,
} from '@/activity/application/activity.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: ActivityViewer['workspaceRole'];
}): ActivityViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

@Controller()
export class ActivityController {
  constructor(
    @Inject(ActivityService) private readonly activityService: ActivityService
  ) {}

  @Implement(contract.readState.mark)
  markRead() {
    return implement(contract.readState.mark)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.activityService.markRead(viewerOf(context), input)
      );
  }

  @Implement(contract.drafts.get)
  getDraft() {
    return implement(contract.drafts.get)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.activityService.getDraft(viewerOf(context), input)
      );
  }

  @Implement(contract.drafts.save)
  saveDraft() {
    return implement(contract.drafts.save)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.activityService.saveDraft(viewerOf(context), input, input.body)
      );
  }

  @Implement(contract.typing.ping)
  ping() {
    return implement(contract.typing.ping)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.activityService.ping(viewerOf(context), input)
      );
  }

  @Implement(contract.presence.heartbeat)
  heartbeat() {
    return implement(contract.presence.heartbeat)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.activityService.heartbeat(viewerOf(context), input.away)
      );
  }
}
