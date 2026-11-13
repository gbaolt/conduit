import { DEFAULT_NOTIFICATION_SETTINGS } from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaNotificationSettingsRepository } from './prisma-notification-settings.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'PrismaNotificationSettingsRepository',
  () => {
    const repository = new PrismaNotificationSettingsRepository(prisma);
    const run = crypto.randomUUID();
    const organizationId = run;
    const [owner, other] = [`${run}-owner`, `${run}-other`];
    const schedule = { days: [1, 2], start: '22:00', end: '08:00' };

    beforeAll(async () => {
      await prisma.user.createMany({
        data: [owner, other].map((id) => ({
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
    });

    afterAll(async () => {
      await prisma.organization.delete({ where: { id: organizationId } });
      await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
    });

    it('gives a member with no row the defaults', async () => {
      await expect(
        repository.get({ organizationId, userId: owner })
      ).resolves.toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    });

    it('creates the row on first update, keeps fields the patch leaves out, and clears a schedule with null', async () => {
      const scope = { organizationId, userId: owner };

      await repository.update(scope, {
        dndSchedule: schedule,
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const second = await repository.update(scope, { emailDigest: false });
      expect(second).toEqual({
        dndUntil: null,
        dndSchedule: schedule,
        timeZone: 'Asia/Ho_Chi_Minh',
        emailDigest: false,
      });

      const cleared = await repository.update(scope, { dndSchedule: null });
      expect(cleared.dndSchedule).toBeNull();
    });

    it('scopes a row to its owner', async () => {
      await expect(
        repository.get({ organizationId, userId: other })
      ).resolves.toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    });
  }
);
