import {
  canWorkspace,
  type CreateOrganizationInput,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { organizationError } from '@/organizations/domain/organization-errors';
import { OrganizationsGateway } from '@/organizations/domain/organizations.gateway';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

export type WorkspaceViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsGateway)
    private readonly organizations: OrganizationsGateway,
    @Inject(WorkspaceMembersRepository)
    private readonly members: WorkspaceMembersRepository
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

  async updateMemberRole(
    headers: Headers,
    viewer: WorkspaceViewer,
    memberId: string,
    role: WorkspaceRole
  ) {
    const target = await this.findTarget(viewer, memberId);

    if (
      !canWorkspace('changeRole', viewer.workspaceRole, {
        role: target.role,
        newRole: role,
        isSelf: target.userId === viewer.userId,
      })
    ) {
      throw organizationError('FORBIDDEN');
    }

    await this.organizations.updateMemberRole(
      headers,
      viewer.organizationId,
      memberId,
      role
    );
  }

  async removeMember(
    headers: Headers,
    viewer: WorkspaceViewer,
    memberId: string
  ) {
    const target = await this.findTarget(viewer, memberId);

    if (
      !canWorkspace('removeMember', viewer.workspaceRole, {
        role: target.role,
        isSelf: target.userId === viewer.userId,
      })
    ) {
      throw organizationError('FORBIDDEN');
    }

    await this.organizations.removeMember(
      headers,
      viewer.organizationId,
      memberId
    );
  }

  private async findTarget(viewer: WorkspaceViewer, memberId: string) {
    const target = await this.members.findMember(
      viewer.organizationId,
      memberId
    );
    if (!target) throw organizationError('NOT_FOUND');
    return target;
  }
}
