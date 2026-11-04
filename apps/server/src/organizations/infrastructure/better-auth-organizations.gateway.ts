import type { CreateOrganizationInput } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { isAPIError } from 'better-auth/api';

import type { Auth } from '@/infrastructure/auth/auth.config';
import { organizationError } from '@/organizations/domain/organization-errors';
import type { OrganizationsGateway } from '@/organizations/domain/organizations.gateway';

@Injectable()
export class BetterAuthOrganizationsGateway implements OrganizationsGateway {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService<Auth>
  ) {}

  list(headers: Headers) {
    return this.authService.api.listOrganizations({ headers });
  }

  async create(headers: Headers, input: CreateOrganizationInput) {
    try {
      return await this.authService.api.createOrganization({
        body: input,
        headers,
      });
    } catch (error) {
      if (
        isAPIError(error) &&
        error.body?.code === 'ORGANIZATION_ALREADY_EXISTS'
      ) {
        throw organizationError('SLUG_TAKEN');
      }
      throw error;
    }
  }

  listInvitations(headers: Headers) {
    return this.authService.api.listUserInvitations({ headers });
  }

  async acceptInvitation(headers: Headers, invitationId: string) {
    const result = await this.authService.api.acceptInvitation({
      body: { invitationId },
      headers,
    });
    return { organizationId: result.member.organizationId };
  }
}
