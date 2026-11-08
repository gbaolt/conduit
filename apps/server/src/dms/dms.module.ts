import { Module } from '@nestjs/common';

import { RoomsModule } from '@/rooms/rooms.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { DmsService } from './application/dms.service';
import { DmsRepository } from './domain/dms.repository';
import { PrismaDmsRepository } from './infrastructure/prisma-dms.repository';
import { DmsController } from './presentation/dms.controller';

@Module({
  imports: [RoomsModule, WorkspacesModule],
  controllers: [DmsController],
  providers: [
    DmsService,
    { provide: DmsRepository, useClass: PrismaDmsRepository },
  ],
  exports: [DmsRepository],
})
export class DmsModule {}
