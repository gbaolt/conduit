import { Module } from '@nestjs/common';

import { WorkspaceMembersService } from './application/workspace-members.service';
import { WorkspaceSettingsService } from './application/workspace-settings.service';
import { WorkspaceMembersRepository } from './domain/workspace-members.repository';
import { WorkspaceSettingsRepository } from './domain/workspace-settings.repository';
import { PrismaWorkspaceMembersRepository } from './infrastructure/prisma-workspace-members.repository';
import { PrismaWorkspaceSettingsRepository } from './infrastructure/prisma-workspace-settings.repository';
import { WorkspaceMembersController } from './presentation/workspace-members.controller';
import { WorkspaceSettingsController } from './presentation/workspace-settings.controller';

@Module({
  controllers: [WorkspaceMembersController, WorkspaceSettingsController],
  providers: [
    WorkspaceMembersService,
    WorkspaceSettingsService,
    {
      provide: WorkspaceMembersRepository,
      useClass: PrismaWorkspaceMembersRepository,
    },
    {
      provide: WorkspaceSettingsRepository,
      useClass: PrismaWorkspaceSettingsRepository,
    },
  ],
  exports: [WorkspaceMembersRepository, WorkspaceSettingsRepository],
})
export class WorkspacesModule {}
