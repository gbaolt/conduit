import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaThreadsRepository } from './prisma-threads.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaThreadsRepository', () => {
  const repository = new PrismaThreadsRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const me = `${run}-me`;
  const other = `${run}-other`;
  const roomId = `${run}-channel`;
  const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute));

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [me, other].map((id) => ({
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
    const message = (
      id: string,
      authorId: string,
      minute: number,
      extra: { parentId?: string; deletedAt?: Date; lastReplyAt?: Date } = {}
    ) => ({
      id: `${run}-${id}`,
      clientId: id,
      body: id,
      roomId,
      authorId,
      createdAt: at(minute),
      ...extra,
      parentId: extra.parentId && `${run}-${extra.parentId}`,
    });
    await prisma.message.createMany({
      data: [
        message('mine', me, 0, { lastReplyAt: at(3) }),
        message('replied', other, 1, { lastReplyAt: at(6) }),
        message('theirs', other, 2, { lastReplyAt: at(7) }),
        message('quiet', me, 3),
      ],
    });
    await prisma.message.createMany({
      data: [
        message('mine-1', other, 3, { parentId: 'mine' }),
        message('replied-1', me, 4, { parentId: 'replied' }),
        message('replied-2', other, 5, { parentId: 'replied' }),
        message('replied-3', other, 6, { parentId: 'replied' }),
        message('replied-gone', other, 6, {
          parentId: 'replied',
          deletedAt: at(8),
        }),
        message('theirs-1', other, 7, { parentId: 'theirs' }),
      ],
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [me, other] } } });
    await prisma.$disconnect();
  });

  const list = (roomIds = [roomId]) =>
    repository.list(me, roomIds, { threads: 10, replies: 2 });

  it('lists threads the member started or replied in, newest reply first', async () => {
    const threads = await list();

    expect(threads.map((thread) => thread.root.body)).toEqual([
      'replied',
      'mine',
    ]);
    expect(threads[0]?.channelName).toBe('design');
  });

  it('carries the newest live replies, oldest first', async () => {
    const [replied] = await list();

    expect(replied?.replies.map((reply) => reply.body)).toEqual([
      'replied-2',
      'replied-3',
    ]);
  });

  it('names everyone who wrote in the thread once, root author first', async () => {
    const [replied, mine] = await list();

    expect(replied?.participantIds).toEqual([other, me]);
    expect(mine?.participantIds).toEqual([me, other]);
  });

  it('leaves out rooms the caller did not pass', async () => {
    expect(await list([])).toEqual([]);
  });
});
