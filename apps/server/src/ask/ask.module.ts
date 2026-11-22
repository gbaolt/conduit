import { Module } from '@nestjs/common';

import { AiModule } from '@/ai/ai.module';
import { SearchModule } from '@/search/search.module';

import { AskService } from './application/ask.service';
import { AnswersRepository } from './domain/answers.repository';
import { PrismaAnswersRepository } from './infrastructure/prisma-answers.repository';
import { AskController } from './presentation/ask.controller';

@Module({
  imports: [AiModule, SearchModule],
  controllers: [AskController],
  providers: [
    AskService,
    { provide: AnswersRepository, useClass: PrismaAnswersRepository },
  ],
})
export class AskModule {}
