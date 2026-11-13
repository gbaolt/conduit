import { Module } from '@nestjs/common';

import { FeedModule } from '@/feed/feed.module';
import { RoomsModule } from '@/rooms/rooms.module';

import { ActivityService } from './application/activity.service';
import { ActivityRepository } from './domain/activity.repository';
import { PrismaActivityRepository } from './infrastructure/prisma-activity.repository';
import { ActivityController } from './presentation/activity.controller';

@Module({
  imports: [RoomsModule, FeedModule],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    { provide: ActivityRepository, useClass: PrismaActivityRepository },
  ],
})
export class ActivityModule {}
