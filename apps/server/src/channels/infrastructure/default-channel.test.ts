import { PrismaClient } from '@generated/prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ws from 'ws';

import { ensureDefaultChannel } from './default-channel';

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('ensureDefaultChannel', () => {
  let prisma: PrismaClient;
  const run = crypto.randomUUID();
  const userIds = [`${run}-a`, `${run}-b`];
  const organization = {
    id: run,
    name: 'Công ty Acme',
    slug: `acme-${run}`,
  };

  beforeAll(async () => {
    neonConfig.webSocketConstructor = ws;
    prisma = new PrismaClient({
      adapter: new PrismaNeon({ connectionString }),
    });
    await prisma.user.createMany({
      data: userIds.map((id) => ({ id, name: id, email: `${id}@test.local` })),
    });
    await prisma.organization.create({
      data: { ...organization, createdAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('converges to one default channel and one membership per user under concurrency', async () => {
    const results = await Promise.all([
      ensureDefaultChannel(prisma, organization, userIds),
      ensureDefaultChannel(prisma, organization, userIds),
    ]);

    const channels = await prisma.room.findMany({
      where: { organizationId: organization.id },
      include: { members: true },
    });
    expect(channels).toHaveLength(1);
    expect(channels[0]?.name).toBe('all-cong-ty-acme');
    expect(channels[0]?.defaultForOrganizationId).toBe(organization.id);
    expect(channels[0]?.members.map((m) => m.userId).sort()).toEqual(
      [...userIds].sort()
    );
    expect(results.reduce((sum, r) => sum + r.created, 0)).toBe(1);
    expect(results.reduce((sum, r) => sum + r.added, 0)).toBe(2);

    await expect(
      ensureDefaultChannel(prisma, organization, userIds)
    ).resolves.toEqual({ created: 0, added: 0 });
  });
});
