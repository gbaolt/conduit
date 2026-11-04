import { Module } from '@nestjs/common';

import { OrganizationsService } from './application/organizations.service';
import { OrganizationsGateway } from './domain/organizations.gateway';
import { BetterAuthOrganizationsGateway } from './infrastructure/better-auth-organizations.gateway';
import { OrganizationsController } from './presentation/organizations.controller';

@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    {
      provide: OrganizationsGateway,
      useClass: BetterAuthOrganizationsGateway,
    },
  ],
})
export class OrganizationsModule {}
