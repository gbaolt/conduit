import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { SearchService } from '@/search/application/search.service';

@Controller()
export class SearchController {
  constructor(@Inject(SearchService) private readonly search: SearchService) {}

  @Implement(contract.search.query)
  query() {
    return implement(contract.search.query)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.search.query(
          {
            userId: context.user.id,
            organizationId: context.organizationId,
            workspaceRole: context.workspaceRole,
          },
          input
        )
      );
  }
}
