import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';

import {
  ChannelSectionsService,
  type SectionViewer,
} from './channel-sections.service';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
}): SectionViewer {
  return { userId: context.user.id, organizationId: context.organizationId };
}

@Controller()
export class ChannelSectionsController {
  constructor(
    @Inject(ChannelSectionsService)
    private readonly sectionsService: ChannelSectionsService
  ) {}

  @Implement(contract.channelSections.list)
  list() {
    return implement(contract.channelSections.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) => this.sectionsService.list(viewerOf(context)));
  }

  @Implement(contract.channelSections.create)
  create() {
    return implement(contract.channelSections.create)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.sectionsService.create(viewerOf(context), input.name)
      );
  }

  @Implement(contract.channelSections.rename)
  rename() {
    return implement(contract.channelSections.rename)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.sectionsService.rename(
          viewerOf(context),
          input.sectionId,
          input.name
        )
      );
  }

  @Implement(contract.channelSections.delete)
  delete() {
    return implement(contract.channelSections.delete)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.sectionsService.delete(viewerOf(context), input.sectionId)
      );
  }

  @Implement(contract.channelSections.reorder)
  reorder() {
    return implement(contract.channelSections.reorder)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.sectionsService.reorder(viewerOf(context), input.sectionIds)
      );
  }
}
