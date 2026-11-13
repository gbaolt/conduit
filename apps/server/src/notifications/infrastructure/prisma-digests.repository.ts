import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DndScheduleSchema,
  type NotifyLevel,
  type RoomKind,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  DigestCandidate,
  DigestMention,
} from '@/notifications/domain/digest';
import type {
  DigestScope,
  DigestsRepository,
} from '@/notifications/domain/digests.repository';

const keyOf = (first: string, second: string) => `${first}:${second}`;

@Injectable()
export class PrismaDigestsRepository implements DigestsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async candidates(awayBefore: Date): Promise<DigestCandidate[]> {
    // The relation filter is a cheap prefilter by user. The per-workspace heartbeat is read below.
    const items = await this.db.activityItem.findMany({
      where: {
        kind: 'MENTION',
        readAt: null,
        messageId: { not: null },
        user: { presences: { some: { lastActiveAt: { lt: awayBefore } } } },
      },
      select: {
        organizationId: true,
        userId: true,
        roomId: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        room: { select: { name: true, kind: true } },
        actor: { select: { name: true } },
        message: { select: { id: true, parentId: true, body: true } },
      },
    });
    if (items.length === 0) return [];

    const userIds = [...new Set(items.map((item) => item.userId))];
    const roomIds = [...new Set(items.map((item) => item.roomId))];
    const [memberships, workspaceMembers, presences, settings, states] =
      await Promise.all([
        this.db.roomMember.findMany({
          where: { userId: { in: userIds }, roomId: { in: roomIds } },
          select: { roomId: true, userId: true, notify: true, mutedAt: true },
        }),
        this.db.member.findMany({
          where: { userId: { in: userIds }, deactivation: null },
          select: { organizationId: true, userId: true },
        }),
        this.db.presence.findMany({ where: { userId: { in: userIds } } }),
        this.db.notificationSettings.findMany({
          where: { userId: { in: userIds } },
        }),
        this.db.digestState.findMany({ where: { userId: { in: userIds } } }),
      ]);

    const membershipOf = new Map(
      memberships.map((row) => [keyOf(row.roomId, row.userId), row])
    );
    const active = new Set(
      workspaceMembers.map((row) => keyOf(row.organizationId, row.userId))
    );
    const presenceOf = new Map(
      presences.map((row) => [keyOf(row.organizationId, row.userId), row])
    );
    const settingsOf = new Map(
      settings.map((row) => [keyOf(row.organizationId, row.userId), row])
    );
    const stateOf = new Map(
      states.map((row) => [keyOf(row.organizationId, row.userId), row])
    );

    const candidates = new Map<string, DigestCandidate>();
    for (const item of items) {
      const workspaceKey = keyOf(item.organizationId, item.userId);
      const membership = membershipOf.get(keyOf(item.roomId, item.userId));
      // A room the member left, or a member who is gone or deactivated, gets nothing.
      if (!item.message || !membership || !active.has(workspaceKey)) continue;

      const mention: DigestMention = {
        roomId: item.roomId,
        roomName: item.room.name,
        roomKind: item.room.kind.toLowerCase() as RoomKind,
        notify:
          (membership.notify?.toLowerCase() as NotifyLevel | undefined) ?? null,
        muted: membership.mutedAt !== null,
        messageId: item.message.id,
        parentId: item.message.parentId,
        authorName: item.actor.name,
        body: item.message.body,
        createdAt: item.createdAt,
      };

      const existing = candidates.get(workspaceKey);
      if (existing) {
        existing.mentions.push(mention);
        continue;
      }

      const row = settingsOf.get(workspaceKey);
      candidates.set(workspaceKey, {
        organizationId: item.organizationId,
        userId: item.userId,
        email: item.user.email,
        name: item.user.name,
        lastActiveAt: presenceOf.get(workspaceKey)?.lastActiveAt ?? null,
        lastSentAt: stateOf.get(workspaceKey)?.lastSentAt ?? null,
        settings: row
          ? {
              dndUntil: row.dndUntil,
              dndSchedule:
                DndScheduleSchema.safeParse(row.dndSchedule).data ?? null,
              timeZone: row.timeZone,
              emailDigest: row.emailDigest,
            }
          : DEFAULT_NOTIFICATION_SETTINGS,
        mentions: [mention],
      });
    }

    return [...candidates.values()];
  }

  async claim(
    { organizationId, userId }: DigestScope,
    lastActiveAt: Date,
    now: Date
  ) {
    // One statement, so of two overlapping runs only one passes the WHERE and gets a row back.
    const claimed = await this.db.$queryRaw<unknown[]>`
      INSERT INTO "DigestState" ("organizationId", "userId", "lastSentAt")
      VALUES (${organizationId}, ${userId}, ${now})
      ON CONFLICT ("organizationId", "userId")
      DO UPDATE SET "lastSentAt" = EXCLUDED."lastSentAt"
      WHERE "DigestState"."lastSentAt" < ${lastActiveAt}
      RETURNING 1`;
    return claimed.length > 0;
  }

  async release(
    { organizationId, userId }: DigestScope,
    claimedAt: Date,
    previous: Date | null
  ) {
    const where = { organizationId, userId, lastSentAt: claimedAt };
    if (previous) {
      await this.db.digestState.updateMany({
        where,
        data: { lastSentAt: previous },
      });
    } else {
      await this.db.digestState.deleteMany({ where });
    }
  }
}
