import { Module } from '@nestjs/common';

import { NotificationSettingsService } from './application/notification-settings.service';
import { PushNotificationsService } from './application/push-notifications.service';
import { PushSubscriptionsService } from './application/push-subscriptions.service';
import { NotificationSettingsRepository } from './domain/notification-settings.repository';
import { PushAudienceRepository } from './domain/push-audience.repository';
import { PushSender } from './domain/push-sender.port';
import { PushSubscriptionsRepository } from './domain/push-subscriptions.repository';
import { PrismaNotificationSettingsRepository } from './infrastructure/prisma-notification-settings.repository';
import { PrismaPushAudienceRepository } from './infrastructure/prisma-push-audience.repository';
import { PrismaPushSubscriptionsRepository } from './infrastructure/prisma-push-subscriptions.repository';
import { vapidFromEnv, WebPushSender } from './infrastructure/web-push.sender';
import { NotificationSettingsController } from './presentation/notification-settings.controller';
import { PushController } from './presentation/push.controller';

@Module({
  controllers: [NotificationSettingsController, PushController],
  providers: [
    NotificationSettingsService,
    PushNotificationsService,
    PushSubscriptionsService,
    {
      provide: NotificationSettingsRepository,
      useClass: PrismaNotificationSettingsRepository,
    },
    {
      provide: PushSubscriptionsRepository,
      useClass: PrismaPushSubscriptionsRepository,
    },
    {
      provide: PushAudienceRepository,
      useClass: PrismaPushAudienceRepository,
    },
    {
      provide: PushSender,
      useFactory: () => new WebPushSender(vapidFromEnv(process.env)),
    },
  ],
  exports: [NotificationSettingsService, PushNotificationsService],
})
export class NotificationsModule {}
