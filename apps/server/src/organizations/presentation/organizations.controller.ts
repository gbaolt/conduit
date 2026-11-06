import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

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
}
