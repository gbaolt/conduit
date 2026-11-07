import type {
  CreateOrganizationInput,
  InviteRole,
  organizationErrors,
  WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { isAPIError } from 'better-auth/api';

import type { Auth } from '@/infrastructure/auth/auth.config';
import { organizationError } from '@/organizations/domain/organization-errors';
import type { OrganizationsGateway } from '@/organizations/domain/organizations.gateway';

const MEMBER_ERROR_CODES: Record<string, keyof typeof organizationErrors> = {
  MEMBER_NOT_FOUND: 'NOT_FOUND',
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: 'FORBIDDEN',
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: 'FORBIDDEN',
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: 'LAST_OWNER',
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: 'LAST_OWNER',
};

function toMemberError(error: unknown) {
  const code = isAPIError(error) ? error.body?.code : undefined;
  const mapped = code ? MEMBER_ERROR_CODES[code] : undefined;
  return mapped ? organizationError(mapped) : error;
}

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

  async updateMemberRole(
    headers: Headers,
    organizationId: string,
    memberId: string,
    role: WorkspaceRole
  ) {
    try {
      await this.authService.api.updateMemberRole({
        body: { organizationId, memberId, role },
        headers,
      });
    } catch (error) {
      throw toMemberError(error);
    }
  }

  async removeMember(
    headers: Headers,
    organizationId: string,
    memberId: string
  ) {
    try {
      await this.authService.api.removeMember({
        body: { organizationId, memberIdOrEmail: memberId },
        headers,
      });
    } catch (error) {
      throw toMemberError(error);
    }
  }

  async invite(
    headers: Headers,
    organizationId: string,
    email: string,
    role: InviteRole
  ) {
    try {
      await this.authService.api.createInvitation({
        body: { organizationId, email, role },
        headers,
      });
      return 'sent';
    } catch (error) {
      const code = isAPIError(error) ? error.body?.code : undefined;
      if (code === 'USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION') {
        return 'member';
      }
      if (code === 'USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION') {
        return 'invited';
      }
      throw error;
    }
  }

  async cancelInvitation(headers: Headers, invitationId: string) {
    await this.authService.api.cancelInvitation({
      body: { invitationId },
      headers,
    });
  }

  async acceptInvitation(headers: Headers, invitationId: string) {
    const result = await this.authService.api.acceptInvitation({
      body: { invitationId },
      headers,
    });
    return { organizationId: result.member.organizationId };
  }
}
