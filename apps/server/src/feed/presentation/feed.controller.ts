import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { FeedService, type FeedViewer } from '@/feed/application/feed.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
}): FeedViewer {
  return { userId: context.user.id, organizationId: context.organizationId };
}

@Controller()
export class FeedController {
  constructor(@Inject(FeedService) private readonly feedService: FeedService) {}

  @Implement(contract.feed.list)
  list() {
    return implement(contract.feed.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.feedService.list(viewerOf(context), input)
      );
  }

  @Implement(contract.feed.markRead)
  markRead() {
    return implement(contract.feed.markRead)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.feedService.markRead(viewerOf(context), input.ids)
      );
  }

  @Implement(contract.feed.markAllRead)
  markAllRead() {
    return implement(contract.feed.markAllRead)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.feedService.markAllRead(viewerOf(context))
      );
  }
}
