import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DndScheduleSchema,
  type NotificationSettings,
  type UpdateNotificationSettingsInput,
} from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  NotificationScope,
  NotificationSettingsRepository,
} from '@/notifications/domain/notification-settings.repository';

function toSettings(
  row: Prisma.NotificationSettingsGetPayload<object>
): NotificationSettings {
  return {
    dndUntil: row.dndUntil,
    dndSchedule: DndScheduleSchema.safeParse(row.dndSchedule).data ?? null,
    timeZone: row.timeZone,
    emailDigest: row.emailDigest,
  };
}

@Injectable()
export class PrismaNotificationSettingsRepository implements NotificationSettingsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async get({ organizationId, userId }: NotificationScope) {
    const row = await this.db.notificationSettings.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    return row ? toSettings(row) : DEFAULT_NOTIFICATION_SETTINGS;
  }

  async update(
    { organizationId, userId }: NotificationScope,
    patch: UpdateNotificationSettingsInput
  ) {
    // A Json column takes `DbNull` to store null, so the patch's null maps to it.
    const data = {
      ...patch,
      dndSchedule:
        patch.dndSchedule === null ? Prisma.DbNull : patch.dndSchedule,
    };
    const row = await this.db.notificationSettings.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId, ...data },
      update: data,
    });
    return toSettings(row);
  }
}
