import { Module } from '@nestjs/common';

import { RoomsModule } from '@/rooms/rooms.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { ChannelSectionsService } from './application/channel-sections.service';
import { ChannelsService } from './application/channels.service';
import { ChannelSectionsRepository } from './domain/channel-sections.repository';
import { PrismaChannelSectionsRepository } from './infrastructure/prisma-channel-sections.repository';
import { ChannelSectionsController } from './presentation/channel-sections.controller';
import { ChannelsController } from './presentation/channels.controller';

@Module({
  imports: [RoomsModule, WorkspacesModule],
  controllers: [ChannelsController, ChannelSectionsController],
  providers: [
    ChannelsService,
    ChannelSectionsService,
    {
      provide: ChannelSectionsRepository,
      useClass: PrismaChannelSectionsRepository,
    },
  ],
})
export class ChannelsModule {}
