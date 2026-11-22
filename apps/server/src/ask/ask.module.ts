import { Module } from '@nestjs/common';

import { AiModule } from '@/ai/ai.module';
import { FilesModule } from '@/files/files.module';
import { SearchModule } from '@/search/search.module';
import { StorageModule } from '@/storage/storage.module';

import { AskService } from './application/ask.service';
import { AskAttachmentsService } from './application/ask-attachments.service';
import { AnswersRepository } from './domain/answers.repository';
import { AskAttachmentsRepository } from './domain/ask-attachments.repository';
import { AskContextRepository } from './domain/ask-context.repository';
import { PrismaAnswersRepository } from './infrastructure/prisma-answers.repository';
import { PrismaAskAttachmentsRepository } from './infrastructure/prisma-ask-attachments.repository';
import { PrismaAskContextRepository } from './infrastructure/prisma-ask-context.repository';
import { AskController } from './presentation/ask.controller';
import { AskSweepController } from './presentation/ask-sweep.controller';

@Module({
  imports: [AiModule, FilesModule, SearchModule, StorageModule],
  controllers: [AskController, AskSweepController],
  providers: [
    AskService,
    AskAttachmentsService,
    { provide: AnswersRepository, useClass: PrismaAnswersRepository },
    { provide: AskContextRepository, useClass: PrismaAskContextRepository },
    {
      provide: AskAttachmentsRepository,
      useClass: PrismaAskAttachmentsRepository,
    },
  ],
})
export class AskModule {}
