import { Module } from '@nestjs/common';

import { NotificationSettingsService } from './application/notification-settings.service';
import { NotificationSettingsRepository } from './domain/notification-settings.repository';
import { PrismaNotificationSettingsRepository } from './infrastructure/prisma-notification-settings.repository';
import { NotificationSettingsController } from './presentation/notification-settings.controller';

@Module({
  controllers: [NotificationSettingsController],
  providers: [
    NotificationSettingsService,
    {
      provide: NotificationSettingsRepository,
      useClass: PrismaNotificationSettingsRepository,
    },
  ],
  exports: [NotificationSettingsService],
})
export class NotificationsModule {}
