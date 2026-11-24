import { Module } from '@nestjs/common';

import { RoomsModule } from '@/rooms/rooms.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { CanvasesService } from './application/canvases.service';
import { CanvasesRepository } from './domain/canvases.repository';
import { PrismaCanvasesRepository } from './infrastructure/prisma-canvases.repository';
import { CanvasesController } from './presentation/canvases.controller';

@Module({
  imports: [RoomsModule, WorkspacesModule],
  controllers: [CanvasesController],
  providers: [
    CanvasesService,
    { provide: CanvasesRepository, useClass: PrismaCanvasesRepository },
  ],
})
export class CanvasesModule {}
