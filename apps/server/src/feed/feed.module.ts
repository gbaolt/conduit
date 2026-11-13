import { Module } from '@nestjs/common';

import { AiModule } from '@/ai/ai.module';

import { FeedService } from './application/feed.service';
import { FeedRepository } from './domain/feed.repository';
import { PrismaFeedRepository } from './infrastructure/prisma-feed.repository';
import { FeedController } from './presentation/feed.controller';

@Module({
  imports: [AiModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    { provide: FeedRepository, useClass: PrismaFeedRepository },
  ],
  exports: [FeedRepository],
})
export class FeedModule {}
