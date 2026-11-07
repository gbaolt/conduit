import {
  DEFAULT_WORKSPACE_SETTINGS,
  type UpdateWorkspaceSettingsInput,
  type WorkspaceSettings,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { WorkspaceSettingsRepository } from '@/workspaces/domain/workspace-settings.repository';

type Stored = 'EVERYONE' | 'ADMINS';

const toStored = (value: WorkspaceSettings['channelCreators']): Stored =>
  value === 'admins' ? 'ADMINS' : 'EVERYONE';
const fromStored = (value: Stored): WorkspaceSettings['channelCreators'] =>
  value === 'ADMINS' ? 'admins' : 'everyone';

function toSettings(row: {
  channelCreators: Stored;
  publicChannelCreators: Stored;
}): WorkspaceSettings {
  return {
    channelCreators: fromStored(row.channelCreators),
    publicChannelCreators: fromStored(row.publicChannelCreators),
  };
}

@Injectable()
export class PrismaWorkspaceSettingsRepository implements WorkspaceSettingsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async get(organizationId: string) {
    const row = await this.db.workspaceSettings.findUnique({
      where: { organizationId },
    });
    return row ? toSettings(row) : DEFAULT_WORKSPACE_SETTINGS;
  }

  async update(organizationId: string, input: UpdateWorkspaceSettingsInput) {
    // An undefined column is left alone.
    const data = {
      channelCreators: input.channelCreators && toStored(input.channelCreators),
      publicChannelCreators:
        input.publicChannelCreators && toStored(input.publicChannelCreators),
    };
    const row = await this.db.workspaceSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    return toSettings(row);
  }
}
