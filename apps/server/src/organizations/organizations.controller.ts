import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { isAPIError } from 'better-auth/api';

import { arcjet } from '@/orpc/arcjet.middleware';
import { authorized } from '@/orpc/auth.middleware';
import { toORPCError } from '@/orpc/auth-error';

import { OrganizationsService } from './organizations.service';

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
      .handler(async ({ context }) => {
        return this.organizationsService
          .list(context.request)
          .catch(toORPCError);
      });
  }

  @Implement(contract.organizations.create)
  create() {
    return implement(contract.organizations.create)
      .use(authorized)
      .use(arcjet.heavyWrite)
      .handler(async ({ context, input, errors }) => {
        try {
          return await this.organizationsService.create(context.request, input);
        } catch (error) {
          if (
            isAPIError(error) &&
            error.body?.code === 'ORGANIZATION_ALREADY_EXISTS'
          ) {
            throw errors.SLUG_TAKEN();
          }

          return toORPCError(error);
        }
      });
  }

  @Implement(contract.invitations.list)
  listInvitations() {
    return implement(contract.invitations.list)
      .use(authorized)
      .use(arcjet.read)
      .handler(async ({ context }) => {
        return this.organizationsService
          .listInvitations(context.request)
          .catch(toORPCError);
      });
  }

  @Implement(contract.invitations.accept)
  acceptInvitation() {
    return implement(contract.invitations.accept)
      .use(authorized)
      .use(arcjet.write)
      .handler(async ({ context, input }) => {
        return this.organizationsService
          .acceptInvitation(context.request, input.invitationId)
          .catch(toORPCError);
      });
  }
}
