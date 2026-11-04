import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { authorized } from '@/infrastructure/orpc/authorized';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { OrganizationsService } from '@/organizations/application/organizations.service';

@Controller()
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService)
    private readonly organizationsService: OrganizationsService
  ) {}

  @Implement(contract.organizations.list)
  list() {
    return implement(contract.organizations.list)
      .use(authorized)
      .use(arcjet.read)
      .handler(({ context }) =>
        this.organizationsService.list(context.headers)
      );
  }

  @Implement(contract.organizations.create)
  create() {
    return implement(contract.organizations.create)
      .use(authorized)
      .use(arcjet.heavyWrite)
      .handler(({ context, input }) =>
        this.organizationsService.create(context.headers, input)
      );
  }

  @Implement(contract.invitations.list)
  listInvitations() {
    return implement(contract.invitations.list)
      .use(authorized)
      .use(arcjet.read)
      .handler(({ context }) =>
        this.organizationsService.listInvitations(context.headers)
      );
  }

  @Implement(contract.invitations.accept)
  acceptInvitation() {
    return implement(contract.invitations.accept)
      .use(authorized)
      .use(arcjet.write)
      .handler(({ context, input }) =>
        this.organizationsService.acceptInvitation(
          context.headers,
          input.invitationId
        )
      );
  }
}
