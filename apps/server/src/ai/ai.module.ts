import { Module } from '@nestjs/common';

import { AiAccessService } from './application/ai-access.service';
import { AiSettingsRepository } from './domain/ai-settings.repository';
import { ModelPort } from './domain/model.port';
import { AiSdkModel } from './infrastructure/ai-sdk-model';
import { PrismaAiSettingsRepository } from './infrastructure/prisma-ai-settings.repository';
import { AiSettingsController } from './presentation/ai-settings.controller';

@Module({
  controllers: [AiSettingsController],
  providers: [
    AiAccessService,
    { provide: ModelPort, useClass: AiSdkModel },
    { provide: AiSettingsRepository, useClass: PrismaAiSettingsRepository },
  ],
  exports: [AiAccessService, ModelPort],
})
export class AiModule {}
