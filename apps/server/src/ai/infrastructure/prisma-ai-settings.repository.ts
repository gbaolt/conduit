import { type AiSettings, DEFAULT_AI_SETTINGS } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import type { AiSettingsRepository } from '@/ai/domain/ai-settings.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PrismaAiSettingsRepository implements AiSettingsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async get(organizationId: string): Promise<AiSettings> {
    const row = await this.db.workspaceSettings.findUnique({
      where: { organizationId },
      select: { aiEnabled: true },
    });
    return row ?? DEFAULT_AI_SETTINGS;
  }

  async set(organizationId: string, settings: AiSettings): Promise<AiSettings> {
    return this.db.workspaceSettings.upsert({
      where: { organizationId },
      create: { organizationId, aiEnabled: settings.aiEnabled },
      update: { aiEnabled: settings.aiEnabled },
      select: { aiEnabled: true },
    });
  }
}
