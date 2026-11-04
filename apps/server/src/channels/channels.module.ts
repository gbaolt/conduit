import { Module } from '@nestjs/common';

import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { ChannelSectionsService } from './application/channel-sections.service';
import { ChannelsService } from './application/channels.service';
import { ChannelSectionsRepository } from './domain/channel-sections.repository';
import { ChannelsRepository } from './domain/channels.repository';
import { PrismaChannelSectionsRepository } from './infrastructure/prisma-channel-sections.repository';
import { PrismaChannelsRepository } from './infrastructure/prisma-channels.repository';
import { ChannelSectionsController } from './presentation/channel-sections.controller';
import { ChannelsController } from './presentation/channels.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [ChannelsController, ChannelSectionsController],
  providers: [
    ChannelsService,
    ChannelSectionsService,
    { provide: ChannelsRepository, useClass: PrismaChannelsRepository },
    {
      provide: ChannelSectionsRepository,
      useClass: PrismaChannelSectionsRepository,
    },
  ],
})
export class ChannelsModule {}
