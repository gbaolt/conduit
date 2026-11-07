import { Module } from '@nestjs/common';

import { ChannelsModule } from '@/channels/channels.module';

import { ActivityService } from './application/activity.service';
import { ActivityRepository } from './domain/activity.repository';
import { PrismaActivityRepository } from './infrastructure/prisma-activity.repository';
import { ActivityController } from './presentation/activity.controller';

@Module({
  imports: [ChannelsModule],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    { provide: ActivityRepository, useClass: PrismaActivityRepository },
  ],
})
export class ActivityModule {}
