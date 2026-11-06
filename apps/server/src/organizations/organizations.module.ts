import { Module } from '@nestjs/common';

import { StorageModule } from '@/storage/storage.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { OrganizationsService } from './application/organizations.service';
import { InvitationsRepository } from './domain/invitations.repository';
import { JoinAccessRepository } from './domain/join-access.repository';
import { OrganizationsGateway } from './domain/organizations.gateway';
import { BetterAuthOrganizationsGateway } from './infrastructure/better-auth-organizations.gateway';
import { PrismaInvitationsRepository } from './infrastructure/prisma-invitations.repository';
import { PrismaJoinAccessRepository } from './infrastructure/prisma-join-access.repository';
import { OrganizationsController } from './presentation/organizations.controller';

@Module({
  imports: [WorkspacesModule, StorageModule],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    { provide: InvitationsRepository, useClass: PrismaInvitationsRepository },
    { provide: JoinAccessRepository, useClass: PrismaJoinAccessRepository },
    {
      provide: OrganizationsGateway,
      useClass: BetterAuthOrganizationsGateway,
    },
  ],
})
export class OrganizationsModule {}
