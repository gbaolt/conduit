import { Module } from '@nestjs/common';

import { RoomsModule } from '@/rooms/rooms.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { CanvasesService } from './application/canvases.service';
import { CanvasesRepository } from './domain/canvases.repository';
import { LiveblocksPort } from './domain/liveblocks.port';
import { LiveblocksGateway } from './infrastructure/liveblocks.gateway';
import { PrismaCanvasesRepository } from './infrastructure/prisma-canvases.repository';
import { CanvasesController } from './presentation/canvases.controller';

@Module({
  imports: [RoomsModule, WorkspacesModule],
  controllers: [CanvasesController],
  providers: [
    CanvasesService,
    { provide: CanvasesRepository, useClass: PrismaCanvasesRepository },
    { provide: LiveblocksPort, useClass: LiveblocksGateway },
  ],
})
export class CanvasesModule {}
