import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';
import { OrganizationsService } from '@/organizations/application/organizations.service';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: WorkspaceViewer['workspaceRole'];
}): WorkspaceViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

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
        this.organizationsService.list(context.headers, context.user.id)
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

  @Implement(contract.organizations.update)
  update() {
    return implement(contract.organizations.update)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.organizationsService.update(
          context.headers,
          viewerOf(context),
          input
        )
      );
  }

  @Implement(contract.organizations.iconUploadUrl)
  iconUploadUrl() {
    return implement(contract.organizations.iconUploadUrl)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.organizationsService.iconUploadUrl(viewerOf(context), input)
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

  @Implement(contract.invitations.get)
  getInvitation() {
    return implement(contract.invitations.get)
      .use(authorized)
      .use(arcjet.read)
      .handler(({ input }) =>
        this.organizationsService.previewInvitation(input.invitationId)
      );
  }

  @Implement(contract.invitations.create)
  createInvitations() {
    return implement(contract.invitations.create)
      .use(authorized)
      .use(arcjet.heavyWrite)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.organizationsService.inviteToWorkspace(
          context.headers,
          viewerOf(context),
          input.emails,
          input.role
        )
      );
  }

  @Implement(contract.invitations.listForWorkspace)
  listWorkspaceInvitations() {
    return implement(contract.invitations.listForWorkspace)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.organizationsService.listWorkspaceInvitations(viewerOf(context))
      );
  }

  @Implement(contract.invitations.revoke)
  revokeInvitation() {
    return implement(contract.invitations.revoke)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.organizationsService.revokeInvitation(
          context.headers,
          viewerOf(context),
          input.invitationId
        )
      );
  }

  @Implement(contract.members.updateRole)
  updateMemberRole() {
    return implement(contract.members.updateRole)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.organizationsService.updateMemberRole(
          context.headers,
          viewerOf(context),
          input.memberId,
          input.role
        )
      );
  }

  @Implement(contract.members.remove)
  removeMember() {
    return implement(contract.members.remove)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.organizationsService.removeMember(
          context.headers,
          viewerOf(context),
          input.memberId
        )
      );
  }

  @Implement(contract.joinLink.get)
  getJoinLink() {
    return implement(contract.joinLink.get)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.organizationsService.getJoinLink(viewerOf(context))
      );
  }

  @Implement(contract.joinLink.reset)
  resetJoinLink() {
    return implement(contract.joinLink.reset)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.organizationsService.resetJoinLink(viewerOf(context))
      );
  }

  // Signed out on purpose: the join page names the workspace before the visitor signs in.
  @AllowAnonymous()
  @Implement(contract.joinLink.preview)
  previewJoinLink() {
    return implement(contract.joinLink.preview)
      .use(arcjet.readAnonymous)
      .handler(({ input }) =>
        this.organizationsService.previewJoinLink(input.token)
      );
  }

  @Implement(contract.joinLink.join)
  joinWithLink() {
    return implement(contract.joinLink.join)
      .use(authorized)
      .use(arcjet.heavyWrite)
      .handler(({ context, input }) =>
        this.organizationsService.joinWithLink(
          context.headers,
          context.user.id,
          input.token
        )
      );
  }

  @Implement(contract.allowedDomains.list)
  listAllowedDomains() {
    return implement(contract.allowedDomains.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context }) =>
        this.organizationsService.listAllowedDomains(viewerOf(context))
      );
  }

  @Implement(contract.allowedDomains.set)
  setAllowedDomains() {
    return implement(contract.allowedDomains.set)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.organizationsService.setAllowedDomains(
          viewerOf(context),
          input.domains
        )
      );
  }

  @Implement(contract.organizations.joinable)
  listJoinable() {
    return implement(contract.organizations.joinable)
      .use(authorized)
      .use(arcjet.read)
      .handler(({ context }) =>
        this.organizationsService.listJoinable(context.user)
      );
  }

  @Implement(contract.organizations.join)
  joinOrganization() {
    return implement(contract.organizations.join)
      .use(authorized)
      .use(arcjet.heavyWrite)
      .handler(({ context, input }) =>
        this.organizationsService.joinOrganization(
          context.headers,
          context.user,
          input.organizationId
        )
      );
  }
}
