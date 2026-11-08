import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaSavedMessagesRepository } from './prisma-saved-messages.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaSavedMessagesRepository', () => {
  const repository = new PrismaSavedMessagesRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const owner = `${run}-owner`;
  const other = `${run}-other`;
  const roomId = `${run}-channel`;
  const messageId = `${run}-message`;
  const deletedId = `${run}-deleted`;

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
    await prisma.room.create({
      data: { id: roomId, organizationId, name: 'design' },
    });
    await prisma.message.createMany({
      data: [
        { id: messageId, clientId: 'a', body: 'hello' },
        { id: deletedId, clientId: 'b', body: '', deletedAt: new Date() },
      ].map((message) => ({ ...message, roomId, authorId: owner })),
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
    await prisma.$disconnect();
  });

  it('keeps a save private to its owner', async () => {
    await repository.add(owner, messageId);

    expect(await repository.list(owner, [roomId], 10)).toHaveLength(1);
    expect(await repository.list(other, [roomId], 10)).toHaveLength(0);
  });

  it('saves once however many times it is added', async () => {
    await repository.add(owner, messageId);
    await repository.add(owner, messageId);

    expect(await repository.list(owner, [roomId], 10)).toHaveLength(1);
  });

  it('leaves out channels the caller did not pass and deleted messages', async () => {
    await repository.add(owner, deletedId);

    expect(await repository.list(owner, [], 10)).toHaveLength(0);
    const saved = await repository.list(owner, [roomId], 10);
    expect(saved.map((item) => item.message.id)).toEqual([messageId]);
    expect(saved[0]?.channelName).toBe('design');
  });

  it('names no conversation for a DM', async () => {
    const dm = await prisma.room.create({
      data: {
        organizationId,
        name: `${organizationId}:${owner}`,
        dmKey: `${organizationId}:${owner}`,
        kind: 'DM',
        visibility: 'PRIVATE',
      },
    });
    await prisma.message.create({
      data: {
        id: `${run}-dm`,
        roomId: dm.id,
        authorId: owner,
        clientId: 'dm',
        body: 'note',
      },
    });
    await repository.add(owner, `${run}-dm`);

    const saved = await repository.list(owner, [dm.id], 10);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.channelName).toBeNull();
  });

  it('removes a save', async () => {
    await repository.remove(owner, messageId);

    expect(await repository.list(owner, [roomId], 10)).toHaveLength(0);
  });
});
