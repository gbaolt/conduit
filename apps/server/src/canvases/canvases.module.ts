import { Module } from '@nestjs/common';

import { AiModule } from '@/ai/ai.module';
import { MessagesModule } from '@/messages/messages.module';
import { RoomsModule } from '@/rooms/rooms.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { CanvasCommentsService } from './application/canvas-comments.service';
import { CanvasDraftService } from './application/canvas-draft.service';
import { CanvasVersionsService } from './application/canvas-versions.service';
import { CanvasesService } from './application/canvases.service';
import { CanvasCommentsRepository } from './domain/canvas-comments.repository';
import { CanvasVersionsRepository } from './domain/canvas-versions.repository';
import { CanvasesRepository } from './domain/canvases.repository';
import { LiveblocksPort } from './domain/liveblocks.port';
import { LiveblocksGateway } from './infrastructure/liveblocks.gateway';
import { PrismaCanvasCommentsRepository } from './infrastructure/prisma-canvas-comments.repository';
import { PrismaCanvasVersionsRepository } from './infrastructure/prisma-canvas-versions.repository';
import { PrismaCanvasesRepository } from './infrastructure/prisma-canvases.repository';
import { CanvasesController } from './presentation/canvases.controller';

@Module({
  imports: [AiModule, MessagesModule, RoomsModule, WorkspacesModule],
  controllers: [CanvasesController],
  providers: [
    CanvasesService,
    CanvasCommentsService,
    CanvasVersionsService,
    CanvasDraftService,
    { provide: CanvasesRepository, useClass: PrismaCanvasesRepository },
    {
      provide: CanvasCommentsRepository,
      useClass: PrismaCanvasCommentsRepository,
    },
    {
      provide: CanvasVersionsRepository,
      useClass: PrismaCanvasVersionsRepository,
    },
    { provide: LiveblocksPort, useClass: LiveblocksGateway },
  ],
})
export class CanvasesModule {}
