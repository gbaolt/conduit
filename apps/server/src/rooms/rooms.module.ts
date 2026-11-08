import { Module } from '@nestjs/common';

import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { RoomsService } from './application/rooms.service';
import { RoomsRepository } from './domain/rooms.repository';
import { PrismaRoomsRepository } from './infrastructure/prisma-rooms.repository';
import { RoomsController } from './presentation/rooms.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    { provide: RoomsRepository, useClass: PrismaRoomsRepository },
  ],
  exports: [RoomsRepository, RoomsService],
})
export class RoomsModule {}
