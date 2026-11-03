import { Module } from '@nestjs/common';

import { WorkspacesModule } from '@/workspaces/workspaces.module';

import { ChannelSectionsController } from './channel-sections.controller';
import { ChannelSectionsRepository } from './channel-sections.repository';
import { ChannelSectionsService } from './channel-sections.service';
import { ChannelsController } from './channels.controller';
import { ChannelsRepository } from './channels.repository';
import { ChannelsService } from './channels.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [ChannelsController, ChannelSectionsController],
  providers: [
    ChannelsService,
    ChannelSectionsService,
    ChannelsRepository,
    ChannelSectionsRepository,
  ],
})
export class ChannelsModule {}
