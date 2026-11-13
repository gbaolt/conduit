import { Module } from '@nestjs/common';

import { FeedRepository } from './domain/feed.repository';
import { PrismaFeedRepository } from './infrastructure/prisma-feed.repository';

@Module({
  providers: [{ provide: FeedRepository, useClass: PrismaFeedRepository }],
  exports: [FeedRepository],
})
export class FeedModule {}
