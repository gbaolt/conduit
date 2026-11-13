import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DndScheduleSchema,
  type NotifyLevel,
  type RoomKind,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  PushAudience,
  PushAudienceRepository,
  PushRecipient,
} from '@/notifications/domain/push-audience.repository';

/** The kinds of item that make a message a mention or a thread reply for its recipient. */
const ITEM_EVENTS: Partial<Record<string, PushRecipient['itemKind']>> = {
  MENTION: 'mention',
  THREAD_REPLY: 'thread_reply',
};

@Injectable()
export class PrismaPushAudienceRepository implements PushAudienceRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async audienceFor(message: {
    id: string;
    roomId: string;
    authorId: string;
    mentionedUserIds: string[];
  }): Promise<PushAudience | null> {
    const room = await this.db.room.findUnique({
      where: { id: message.roomId },
      select: { name: true, kind: true, organizationId: true },
    });
    if (!room) return null;

    const members = await this.db.roomMember.findMany({
      where: {
        roomId: message.roomId,
        userId: { not: message.authorId },
        user: {
          members: { some: { organizationId: room.organizationId } },
          pushSubscriptions: { some: {} },
        },
      },
      select: {
        userId: true,
        notify: true,
        mutedAt: true,
        user: {
          select: {
            pushSubscriptions: {
              select: { endpoint: true, p256dh: true, auth: true },
            },
          },
        },
      },
    });
    const userIds = members.map((member) => member.userId);

    const [users, items, settings, presences] = await Promise.all([
      this.db.user.findMany({
        where: { id: { in: [message.authorId, ...message.mentionedUserIds] } },
        select: { id: true, name: true },
      }),
      this.db.activityItem.findMany({
        where: {
          messageId: message.id,
          userId: { in: userIds },
          kind: { in: ['MENTION', 'THREAD_REPLY'] },
        },
        select: { userId: true, kind: true },
      }),
      this.db.notificationSettings.findMany({
        where: { organizationId: room.organizationId, userId: { in: userIds } },
      }),
      this.db.presence.findMany({
        where: { organizationId: room.organizationId, userId: { in: userIds } },
      }),
    ]);

    const itemKinds = new Map(items.map((item) => [item.userId, item.kind]));
    const settingsOf = new Map(settings.map((row) => [row.userId, row]));
    const presenceOf = new Map(presences.map((row) => [row.userId, row]));

    const recipients = members.map((member): PushRecipient => {
      const row = settingsOf.get(member.userId);
      const kind = itemKinds.get(member.userId);
      return {
        userId: member.userId,
        itemKind: (kind && ITEM_EVENTS[kind]) || null,
        notify: member.notify
          ? (member.notify.toLowerCase() as NotifyLevel)
          : null,
        muted: member.mutedAt !== null,
        settings: row
          ? {
              dndUntil: row.dndUntil,
              dndSchedule:
                DndScheduleSchema.safeParse(row.dndSchedule).data ?? null,
              timeZone: row.timeZone,
            }
          : DEFAULT_NOTIFICATION_SETTINGS,
        presence: presenceOf.get(member.userId),
        targets: member.user.pushSubscriptions,
      };
    });

    const names = new Map(users.map((user) => [user.id, user.name]));
    return {
      room: { name: room.name, kind: room.kind.toLowerCase() as RoomKind },
      authorName: names.get(message.authorId) ?? 'Someone',
      mentionNames: Object.fromEntries(
        message.mentionedUserIds.flatMap((id) => {
          const name = names.get(id);
          return name ? [[id, name]] : [];
        })
      ),
      recipients,
    };
  }
}
