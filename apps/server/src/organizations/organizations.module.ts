import { Module } from '@nestjs/common';

import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { OrganizationsService } from './application/organizations.service';
import { InvitationsRepository } from './domain/invitations.repository';
import { OrganizationsGateway } from './domain/organizations.gateway';
import { BetterAuthOrganizationsGateway } from './infrastructure/better-auth-organizations.gateway';
import { PrismaInvitationsRepository } from './infrastructure/prisma-invitations.repository';
import { OrganizationsController } from './presentation/organizations.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    { provide: InvitationsRepository, useClass: PrismaInvitationsRepository },
    {
      provide: OrganizationsGateway,
      useClass: BetterAuthOrganizationsGateway,
    },
  ],
})
export class OrganizationsModule {}
