import { Module } from '@nestjs/common';

import { WorkspaceMembersRepository } from './domain/workspace-members.repository';
import { PrismaWorkspaceMembersRepository } from './infrastructure/prisma-workspace-members.repository';

@Module({
  providers: [
    {
      provide: WorkspaceMembersRepository,
      useClass: PrismaWorkspaceMembersRepository,
    },
  ],
  exports: [WorkspaceMembersRepository],
})
export class WorkspacesModule {}
