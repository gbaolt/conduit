import { Module } from '@nestjs/common';

import { WorkspaceMembersService } from './application/workspace-members.service';
import { WorkspaceMembersRepository } from './domain/workspace-members.repository';
import { PrismaWorkspaceMembersRepository } from './infrastructure/prisma-workspace-members.repository';
import { WorkspaceMembersController } from './presentation/workspace-members.controller';

@Module({
  controllers: [WorkspaceMembersController],
  providers: [
    WorkspaceMembersService,
    {
      provide: WorkspaceMembersRepository,
      useClass: PrismaWorkspaceMembersRepository,
    },
  ],
  exports: [WorkspaceMembersRepository],
})
export class WorkspacesModule {}
