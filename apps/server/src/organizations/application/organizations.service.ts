import type { CreateOrganizationInput } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { OrganizationsGateway } from '@/organizations/domain/organizations.gateway';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsGateway)
    private readonly organizations: OrganizationsGateway
  ) {}

  list(headers: Headers) {
    return this.organizations.list(headers);
  }

  create(headers: Headers, input: CreateOrganizationInput) {
    return this.organizations.create(headers, input);
  }

  async listInvitations(headers: Headers) {
    const invitations = await this.organizations.listInvitations(headers);
    const now = new Date();

    // Better Auth keeps expired invitations "pending", but accepting one fails.
    return invitations.filter((invitation) => invitation.expiresAt > now);
  }

  acceptInvitation(headers: Headers, invitationId: string) {
    return this.organizations.acceptInvitation(headers, invitationId);
  }
}
