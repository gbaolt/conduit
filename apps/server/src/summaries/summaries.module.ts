import { Module } from '@nestjs/common';

import { AiModule } from '@/ai/ai.module';
import { MessagesModule } from '@/messages/messages.module';

import { SummariesService } from './application/summaries.service';
import { SummariesRepository } from './domain/summaries.repository';
import { PrismaSummariesRepository } from './infrastructure/prisma-summaries.repository';
import { SummariesController } from './presentation/summaries.controller';

@Module({
  imports: [AiModule, MessagesModule],
  controllers: [SummariesController],
  providers: [
    SummariesService,
    { provide: SummariesRepository, useClass: PrismaSummariesRepository },
  ],
})
export class SummariesModule {}
