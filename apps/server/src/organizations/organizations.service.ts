import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import type { Auth } from '@/auth/auth.config';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService<Auth>
  ) {}

  list(request: Request) {
    return this.authService.api.listOrganizations({
      headers: fromNodeHeaders(request.headers),
    });
  }

  create(request: Request, input: { name: string; slug: string }) {
    return this.authService.api.createOrganization({
      body: input,
      headers: fromNodeHeaders(request.headers),
    });
  }

  async listInvitations(request: Request) {
    const invitations = await this.authService.api.listUserInvitations({
      headers: fromNodeHeaders(request.headers),
    });
    const now = new Date();

    // Better Auth keeps expired invitations "pending", but accepting one fails.
    return invitations.filter((invitation) => invitation.expiresAt > now);
  }

  async acceptInvitation(request: Request, invitationId: string) {
    const result = await this.authService.api.acceptInvitation({
      body: { invitationId },
      headers: fromNodeHeaders(request.headers),
    });

    return { organizationId: result.member.organizationId };
  }
}
