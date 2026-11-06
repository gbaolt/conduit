import { randomBytes } from 'node:crypto';

import {
  canWorkspace,
  type CreateInvitationsResult,
  type CreateOrganizationInput,
  type InviteRole,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { InvitationsRepository } from '@/organizations/domain/invitations.repository';
import { JoinAccessRepository } from '@/organizations/domain/join-access.repository';
import { organizationError } from '@/organizations/domain/organization-errors';
import { OrganizationsGateway } from '@/organizations/domain/organizations.gateway';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

const newToken = () => randomBytes(32).toString('base64url');

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsGateway)
    private readonly organizations: OrganizationsGateway,
    @Inject(WorkspaceMembersRepository)
    private readonly members: WorkspaceMembersRepository,
    @Inject(InvitationsRepository)
    private readonly invitations: InvitationsRepository,
    @Inject(JoinAccessRepository)
    private readonly joinAccess: JoinAccessRepository
  ) {}

  async list(headers: Headers, userId: string) {
    const [organizations, deactivated] = await Promise.all([
      this.organizations.list(headers),
      this.members.deactivatedOrganizationIds(userId),
    ]);
    return organizations.filter(({ id }) => !deactivated.includes(id));
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

  async inviteToWorkspace(
    headers: Headers,
    viewer: WorkspaceViewer,
    emails: string[],
    role: InviteRole
  ): Promise<CreateInvitationsResult> {
    if (!canWorkspace('invite', viewer.workspaceRole)) {
      throw organizationError('FORBIDDEN');
    }

    const result: CreateInvitationsResult = { sent: [], skipped: [] };
    // Sequential: each call sends an email, and a repeated address must see the first invitation.
    for (const email of new Set(emails.map((e) => e.trim().toLowerCase()))) {
      const outcome = await this.organizations.invite(
        headers,
        viewer.organizationId,
        email,
        role
      );
      if (outcome === 'sent') result.sent.push(email);
      else result.skipped.push({ email, reason: outcome });
    }
    return result;
  }

  listWorkspaceInvitations(viewer: WorkspaceViewer) {
    if (!canWorkspace('invite', viewer.workspaceRole)) {
      throw organizationError('FORBIDDEN');
    }
    return this.invitations.listPending(viewer.organizationId);
  }

  async revokeInvitation(
    headers: Headers,
    viewer: WorkspaceViewer,
    invitationId: string
  ) {
    if (!canWorkspace('revokeInvitation', viewer.workspaceRole)) {
      throw organizationError('FORBIDDEN');
    }

    // Better Auth would cancel an invitation of any workspace the caller administers.
    const invitation = await this.invitations.findPending(invitationId);
    if (invitation?.organizationId !== viewer.organizationId) {
      throw organizationError('INVITATION_NOT_FOUND');
    }

    await this.organizations.cancelInvitation(headers, invitationId);
  }

  async previewInvitation(invitationId: string) {
    const invitation = await this.invitations.findPending(invitationId);
    if (!invitation) throw organizationError('INVITATION_NOT_FOUND');
    return {
      email: invitation.email,
      organizationName: invitation.organizationName,
    };
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

  async getJoinLink(viewer: WorkspaceViewer) {
    this.requireJoinLinkAdmin(viewer);
    const token = await this.joinAccess.getOrCreateToken(
      viewer.organizationId,
      viewer.userId,
      newToken()
    );
    return { token };
  }

  async resetJoinLink(viewer: WorkspaceViewer) {
    this.requireJoinLinkAdmin(viewer);
    const token = newToken();
    await this.joinAccess.replaceToken(
      viewer.organizationId,
      viewer.userId,
      token
    );
    return { token };
  }

  async previewJoinLink(token: string) {
    const link = await this.findLink(token);
    return { organizationName: link.organizationName, logo: link.logo };
  }

  async joinWithLink(headers: Headers, userId: string, token: string) {
    const { organizationId } = await this.findLink(token);
    await this.joinWithoutInvitation(headers, userId, organizationId);
    return { organizationId };
  }

  /** Idempotent: a current member only has the workspace made active. */
  private async joinWithoutInvitation(
    headers: Headers,
    userId: string,
    organizationId: string
  ) {
    if (await this.members.isDeactivated(organizationId, userId)) {
      throw organizationError('DEACTIVATED');
    }
    await this.organizations.addMember(userId, organizationId);
    await this.organizations.setActive(headers, organizationId);
  }

  private async findLink(token: string) {
    const link = await this.joinAccess.findByToken(token);
    if (!link) throw organizationError('JOIN_LINK_INVALID');
    return link;
  }

  private requireJoinLinkAdmin(viewer: WorkspaceViewer) {
    if (!canWorkspace('manageJoinLink', viewer.workspaceRole)) {
      throw organizationError('FORBIDDEN');
    }
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
