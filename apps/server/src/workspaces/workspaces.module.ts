import { Module } from '@nestjs/common';

import { WorkspaceMembersRepository } from './workspace-members.repository';

@Module({
  providers: [WorkspaceMembersRepository],
  exports: [WorkspaceMembersRepository],
})
export class WorkspacesModule {}
