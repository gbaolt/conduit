import { Inject, Injectable } from '@nestjs/common';

import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

@Injectable()
export class WorkspaceMembersService {
  constructor(
    @Inject(WorkspaceMembersRepository)
    private readonly members: WorkspaceMembersRepository
  ) {}

  list(organizationId: string) {
    return this.members.list(organizationId);
  }
}
