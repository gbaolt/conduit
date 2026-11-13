import type { SubscribePushInput } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { PushSubscriptionsRepository } from '@/notifications/domain/push-subscriptions.repository';

@Injectable()
export class PrismaPushSubscriptionsRepository implements PushSubscriptionsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async subscribe(userId: string, { endpoint, keys }: SubscribePushInput) {
    const data = { userId, p256dh: keys.p256dh, auth: keys.auth };
    await this.db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, ...data },
      update: data,
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.db.pushSubscription.deleteMany({ where: { endpoint, userId } });
  }

  async forget(endpoint: string) {
    await this.db.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async markDelivered(endpoints: string[], at: Date) {
    if (endpoints.length === 0) return;
    await this.db.pushSubscription.updateMany({
      where: { endpoint: { in: endpoints } },
      data: { lastSuccessAt: at },
    });
  }
}
