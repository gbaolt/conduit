import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaActivityRepository } from './prisma-activity.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaActivityRepository', () => {
  const repository = new PrismaActivityRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const userId = `${run}-user`;
  const roomId = `${run}-channel`;
  const oldId = `${run}-old`;
  const newId = `${run}-new`;
  const scope = { roomId, userId, parentId: '' };

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
    await prisma.room.create({
      data: { id: roomId, organizationId, name: 'design' },
    });
    for (const [id, minute] of [
      [oldId, 0],
      [newId, 5],
    ] as const) {
      await prisma.message.create({
        data: {
          id,
          roomId,
          authorId: userId,
          clientId: id,
          body: id,
          createdAt: new Date(Date.UTC(2026, 10, 7, 10, minute)),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const readState = () =>
    prisma.readState.findUniqueOrThrow({
      where: { roomId_userId: { roomId, userId } },
    });

  it('creates the read position, moves it forward, and never moves it back', async () => {
    await expect(
      repository.markRead({ roomId, userId, messageId: oldId })
    ).resolves.toBe(true);
    expect((await readState()).lastReadMessageId).toBe(oldId);

    await repository.markRead({ roomId, userId, messageId: newId });
    expect((await readState()).lastReadMessageId).toBe(newId);

    await repository.markRead({ roomId, userId, messageId: oldId });
    expect((await readState()).lastReadMessageId).toBe(newId);
  });

  it('refuses a message that is not in the channel', async () => {
    await expect(
      repository.markRead({ roomId, userId, messageId: 'missing' })
    ).resolves.toBe(false);
  });

  it('reads each room the member is in up to its latest message, and only forward', async () => {
    const mine = `${run}-mine`;
    const notMine = `${run}-not-mine`;
    const quiet = `${run}-quiet`;
    const all = [mine, notMine, quiet];
    const at = new Date(Date.UTC(2026, 10, 8, 9));
    await prisma.room.createMany({
      data: [
        { id: mine, organizationId, name: 'mine', lastMessageAt: at },
        { id: notMine, organizationId, name: 'not-mine', lastMessageAt: at },
        { id: quiet, organizationId, name: 'quiet' },
      ],
    });
    await prisma.roomMember.createMany({
      data: [mine, quiet].map((room) => ({ roomId: room, userId })),
    });
    await prisma.message.create({
      data: {
        id: `${run}-last`,
        roomId: mine,
        authorId: userId,
        clientId: 'last',
        body: 'last',
        createdAt: at,
      },
    });
    const states = () =>
      prisma.readState.findMany({ where: { userId, roomId: { in: all } } });

    await repository.markRoomsRead({ userId, organizationId, roomIds: all });

    expect(await states()).toEqual([
      expect.objectContaining({
        roomId: mine,
        lastReadAt: at,
        lastReadMessageId: `${run}-last`,
      }),
    ]);

    const later = new Date(at.getTime() + 3_600_000);
    await prisma.readState.update({
      where: { roomId_userId: { roomId: mine, userId } },
      data: { lastReadAt: later },
    });
    await repository.markRoomsRead({ userId, organizationId, roomIds: all });

    expect(await states()).toEqual([
      expect.objectContaining({ roomId: mine, lastReadAt: later }),
    ]);
  });

  it('keeps a thread draft apart from the channel draft and deletes on an empty body', async () => {
    const thread = { ...scope, parentId: 'root' };

    await repository.saveDraft(scope, 'channel text');
    await repository.saveDraft(thread, 'thread text');
    await repository.saveDraft(scope, 'channel text, edited');

    await expect(repository.getDraft(scope)).resolves.toBe(
      'channel text, edited'
    );
    await expect(repository.getDraft(thread)).resolves.toBe('thread text');

    await repository.saveDraft(scope, '');
    await expect(repository.getDraft(scope)).resolves.toBe('');
    await expect(repository.getDraft(thread)).resolves.toBe('thread text');
  });

  it('upserts typing and presence rows', async () => {
    await repository.setTyping(scope, new Date(Date.now() + 5000));
    await repository.setTyping(scope, new Date(Date.now() + 10_000));
    await repository.recordHeartbeat({
      organizationId,
      userId,
      away: false,
      at: new Date(),
    });
    await repository.recordHeartbeat({
      organizationId,
      userId,
      away: true,
      at: new Date(),
    });

    expect(await prisma.typingState.count({ where: { roomId } })).toBe(1);
    const presence = await prisma.presence.findMany({
      where: { organizationId },
    });
    expect(presence).toHaveLength(1);
    expect(presence[0]?.away).toBe(true);
  });
});
