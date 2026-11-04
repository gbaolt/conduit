import { Module } from '@nestjs/common';

import { UsersService } from './application/users.service';
import { SessionsGateway } from './domain/sessions.gateway';
import { BetterAuthSessionsGateway } from './infrastructure/better-auth-sessions.gateway';
import { UsersController } from './presentation/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: SessionsGateway, useClass: BetterAuthSessionsGateway },
  ],
})
export class UsersModule {}
