import { Module } from '@nestjs/common';

import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { ChannelSectionsService } from './application/channel-sections.service';
import { ChannelsService } from './application/channels.service';
import { DmsService } from './application/dms.service';
import { ChannelSectionsRepository } from './domain/channel-sections.repository';
import { ChannelsRepository } from './domain/channels.repository';
import { DmsRepository } from './domain/dms.repository';
import { PrismaChannelSectionsRepository } from './infrastructure/prisma-channel-sections.repository';
import { PrismaChannelsRepository } from './infrastructure/prisma-channels.repository';
import { PrismaDmsRepository } from './infrastructure/prisma-dms.repository';
import { ChannelSectionsController } from './presentation/channel-sections.controller';
import { ChannelsController } from './presentation/channels.controller';
import { DmsController } from './presentation/dms.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [ChannelsController, ChannelSectionsController, DmsController],
  providers: [
    ChannelsService,
    ChannelSectionsService,
    DmsService,
    { provide: ChannelsRepository, useClass: PrismaChannelsRepository },
    { provide: DmsRepository, useClass: PrismaDmsRepository },
    {
      provide: ChannelSectionsRepository,
      useClass: PrismaChannelSectionsRepository,
    },
  ],
  exports: [ChannelsRepository, DmsRepository],
})
export class ChannelsModule {}
