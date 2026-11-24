import { Module } from '@nestjs/common';

import { RoomsModule } from '@/rooms/rooms.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { CanvasCommentsService } from './application/canvas-comments.service';
import { CanvasesService } from './application/canvases.service';
import { CanvasCommentsRepository } from './domain/canvas-comments.repository';
import { CanvasesRepository } from './domain/canvases.repository';
import { LiveblocksPort } from './domain/liveblocks.port';
import { LiveblocksGateway } from './infrastructure/liveblocks.gateway';
import { PrismaCanvasCommentsRepository } from './infrastructure/prisma-canvas-comments.repository';
import { PrismaCanvasesRepository } from './infrastructure/prisma-canvases.repository';
import { CanvasesController } from './presentation/canvases.controller';

@Module({
  imports: [RoomsModule, WorkspacesModule],
  controllers: [CanvasesController],
  providers: [
    CanvasesService,
    CanvasCommentsService,
    { provide: CanvasesRepository, useClass: PrismaCanvasesRepository },
    {
      provide: CanvasCommentsRepository,
      useClass: PrismaCanvasCommentsRepository,
    },
    { provide: LiveblocksPort, useClass: LiveblocksGateway },
  ],
})
export class CanvasesModule {}
