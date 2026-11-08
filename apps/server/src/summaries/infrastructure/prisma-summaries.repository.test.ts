import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaSummariesRepository } from './prisma-summaries.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaSummariesRepository', () => {
  const repository = new PrismaSummariesRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const userId = `${run}-user`;
  const channelId = `${run}-channel`;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, name: 'Linh', email: `${userId}@test.local` },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'Acme',
        slug: `acme-${run}`,
        createdAt: new Date(),
      },
    });
    await prisma.channel.create({
      data: { id: channelId, organizationId, name: 'design' },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('stores a summary, finds it, and records the message that shared it', async () => {
    const created = await repository.create({
      organizationId,
      requesterId: userId,
      channelId,
      parentId: null,
      from: new Date('2026-11-01T00:00:00.000Z'),
      to: new Date('2026-11-02T00:00:00.000Z'),
      messageCount: 3,
      bullets: [{ text: 'Ship Friday.', sourceIds: ['a', 'b'] }],
      sourceMessageIds: ['a', 'b'],
    });

    expect(await repository.find(created.id)).toEqual(created);
    expect(created.sharedMessageId).toBeNull();
    expect(
      (await repository.setShared(created.id, 'message-1')).sharedMessageId
    ).toBe('message-1');
  });

  it('gives names by user id and leaves out a user that does not exist', async () => {
    const names = await repository.userNames([userId, `${run}-nobody`]);

    expect([...names]).toEqual([[userId, 'Linh']]);
  });
});
