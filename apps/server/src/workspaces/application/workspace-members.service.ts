import { canWorkspace, type WorkspaceAction } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { organizationError } from '@/organizations/domain/organization-errors';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

@Injectable()
export class WorkspaceMembersService {
  constructor(
    @Inject(WorkspaceMembersRepository)
    private readonly members: WorkspaceMembersRepository
  ) {}

  list(organizationId: string) {
    return this.members.list(organizationId);
  }

  async deactivate(viewer: WorkspaceViewer, memberId: string) {
    const target = await this.authorize(viewer, memberId, 'deactivate');
    await this.members.deactivate(target.memberId, viewer.userId);
  }

  async reactivate(viewer: WorkspaceViewer, memberId: string) {
    const target = await this.authorize(viewer, memberId, 'reactivate');
    await this.members.reactivate(target.memberId);
  }

  private async authorize(
    viewer: WorkspaceViewer,
    memberId: string,
    action: WorkspaceAction
  ) {
    const target = await this.members.findMember(
      viewer.organizationId,
      memberId
    );
    if (!target) throw organizationError('NOT_FOUND');

    const allowed = canWorkspace(action, viewer.workspaceRole, {
      role: target.role,
      isSelf: target.userId === viewer.userId,
    });
    if (!allowed) throw organizationError('FORBIDDEN');

    return target;
  }
}
