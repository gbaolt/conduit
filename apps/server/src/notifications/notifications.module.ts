import { Module } from '@nestjs/common';

import { NotificationSettingsService } from './application/notification-settings.service';
import { PushSubscriptionsService } from './application/push-subscriptions.service';
import { NotificationSettingsRepository } from './domain/notification-settings.repository';
import { PushSubscriptionsRepository } from './domain/push-subscriptions.repository';
import { PrismaNotificationSettingsRepository } from './infrastructure/prisma-notification-settings.repository';
import { PrismaPushSubscriptionsRepository } from './infrastructure/prisma-push-subscriptions.repository';
import { NotificationSettingsController } from './presentation/notification-settings.controller';
import { PushController } from './presentation/push.controller';

@Module({
  controllers: [NotificationSettingsController, PushController],
  providers: [
    NotificationSettingsService,
    PushSubscriptionsService,
    {
      provide: NotificationSettingsRepository,
      useClass: PrismaNotificationSettingsRepository,
    },
    {
      provide: PushSubscriptionsRepository,
      useClass: PrismaPushSubscriptionsRepository,
    },
  ],
  exports: [NotificationSettingsService],
})
export class NotificationsModule {}
