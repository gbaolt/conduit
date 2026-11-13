import { Module } from '@nestjs/common';

import { DigestsService } from './application/digests.service';
import { NotificationSettingsService } from './application/notification-settings.service';
import { DigestMailer } from './domain/digest-mailer.port';
import { DigestsRepository } from './domain/digests.repository';
import { NotificationSettingsRepository } from './domain/notification-settings.repository';
import { PrismaDigestsRepository } from './infrastructure/prisma-digests.repository';
import { PrismaNotificationSettingsRepository } from './infrastructure/prisma-notification-settings.repository';
import { ResendDigestMailer } from './infrastructure/resend-digest.mailer';
import { DigestsController } from './presentation/digests.controller';
import { NotificationSettingsController } from './presentation/notification-settings.controller';

@Module({
  controllers: [NotificationSettingsController, DigestsController],
  providers: [
    NotificationSettingsService,
    DigestsService,
    { provide: DigestsRepository, useClass: PrismaDigestsRepository },
    { provide: DigestMailer, useClass: ResendDigestMailer },
    {
      provide: NotificationSettingsRepository,
      useClass: PrismaNotificationSettingsRepository,
    },
  ],
  exports: [NotificationSettingsService],
})
export class NotificationsModule {}
