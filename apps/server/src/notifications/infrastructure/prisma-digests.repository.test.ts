import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaDigestsRepository } from './prisma-digests.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'PrismaDigestsRepository',
  () => {
    const repository = new PrismaDigestsRepository(prisma);
    const run = crypto.randomUUID();
    const organizationId = run;
    const [bao, linh] = [`${run}-bao`, `${run}-linh`];
    const [roomId, unreadId, readId] = [
      `${run}-room`,
      `${run}-unread`,
      `${run}-read`,
    ];
    const scope = { organizationId, userId: bao };
    const lastActiveAt = new Date('2026-11-13T08:00:00Z');
    const awayBefore = new Date('2026-11-13T11:00:00Z');

    beforeAll(async () => {
      await prisma.user.createMany({
        data: [bao, linh].map((id) => ({
          id,
          name: id,
          email: `${id}@test.local`,
        })),
      });
      await prisma.organization.create({
        data: {
          id: organizationId,
          name: 'Acme',
          slug: `acme-${run}`,
          createdAt: new Date(),
        },
      });
      await prisma.member.create({
        data: {
          id: `${run}-member`,
          organizationId,
          userId: bao,
          role: 'member',
          createdAt: new Date(),
        },
      });
      await prisma.room.create({
        data: { id: roomId, organizationId, name: 'design' },
      });
      await prisma.roomMember.createMany({
        data: [bao, linh].map((userId) => ({ roomId, userId })),
      });
      await prisma.presence.create({
        data: { organizationId, userId: bao, lastActiveAt },
      });
      for (const id of [unreadId, readId]) {
        await prisma.message.create({
          data: {
            id,
            roomId,
            authorId: linh,
            clientId: id,
            body: `<@${bao}> ${id}`,
          },
        });
        await prisma.activityItem.create({
          data: {
            organizationId,
            userId: bao,
            roomId,
            kind: 'MENTION',
            key: `message:${id}`,
            actorId: linh,
            messageId: id,
            readAt: id === readId ? new Date() : null,
          },
        });
      }
    });

    afterAll(async () => {
      await prisma.organization.delete({ where: { id: organizationId } });
      await prisma.user.deleteMany({ where: { id: { in: [bao, linh] } } });
    });

    const mine = async () =>
      (await repository.candidates(awayBefore)).find(
        (row) => row.organizationId === organizationId
      );

    it('returns an away member with only the unread mentions', async () => {
      const found = await mine();

      expect(found).toMatchObject({
        userId: bao,
        email: `${bao}@test.local`,
        lastActiveAt,
        lastSentAt: null,
      });
      expect(found?.mentions.map((row) => row.messageId)).toEqual([unreadId]);
      expect(found?.mentions[0]).toMatchObject({
        roomKind: 'channel',
        roomName: 'design',
        notify: null,
        muted: false,
        authorName: linh,
      });
    });

    it('skips a member whose heartbeat is not before the cutoff', async () => {
      const candidates = await repository.candidates(
        new Date('2026-11-13T07:00:00Z')
      );

      expect(
        candidates.find((row) => row.organizationId === organizationId)
      ).toBeUndefined();
    });

    it('claims once for two overlapping runs, and again only after a new heartbeat', async () => {
      const now = new Date('2026-11-13T12:00:00Z');
      const results = await Promise.all([
        repository.claim(scope, lastActiveAt, now),
        repository.claim(scope, lastActiveAt, now),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await mine())?.lastSentAt).toEqual(now);
      await expect(repository.claim(scope, lastActiveAt, now)).resolves.toBe(
        false
      );
      await expect(
        repository.claim(scope, new Date('2026-11-13T13:00:00Z'), now)
      ).resolves.toBe(true);
    });

    it('releases a claim back to its previous time, or deletes it', async () => {
      const claimedAt = new Date('2026-11-13T14:00:00Z');
      const previous = new Date('2026-11-13T12:00:00Z');
      await prisma.digestState.deleteMany({ where: { organizationId } });

      await repository.claim(scope, lastActiveAt, claimedAt);
      await repository.release(scope, claimedAt, null);
      expect((await mine())?.lastSentAt).toBeNull();

      await prisma.digestState.create({
        data: { ...scope, lastSentAt: claimedAt },
      });
      await repository.release(scope, claimedAt, previous);
      expect((await mine())?.lastSentAt).toEqual(previous);
    });

    it('skips a deactivated member and a room the member left', async () => {
      await prisma.memberDeactivation.create({
        data: { memberId: `${run}-member`, deactivatedById: linh },
      });
      expect(await mine()).toBeUndefined();
      await prisma.memberDeactivation.deleteMany({
        where: { memberId: `${run}-member` },
      });

      expect(await mine()).toBeDefined();
      await prisma.roomMember.delete({
        where: { roomId_userId: { roomId, userId: bao } },
      });
      expect(await mine()).toBeUndefined();
    });
  }
);
