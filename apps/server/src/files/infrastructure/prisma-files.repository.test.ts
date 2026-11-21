import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaFilesRepository } from './prisma-files.repository';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaFilesRepository', () => {
  const repository = new PrismaFilesRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const userId = `${run}-user`;
  const roomId = `${run}-room`;
  const newFile = (size: number) => {
    const id = crypto.randomUUID();
    return {
      id,
      organizationId,
      uploaderId: userId,
      roomId,
      name: 'a.pdf',
      contentType: 'application/pdf',
      size,
      key: `files/${organizationId}/${id}/a.pdf`,
    };
  };

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
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('lets only one of two uploads racing for the last bytes of the cap through', async () => {
    const results = await Promise.all([
      repository.createPending(newFile(60), 100),
      repository.createPending(newFile(60), 100),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.find((result) => !result.created)).toEqual({
      created: false,
      used: 60,
    });
  });

  it('frees the bytes of a cancelled file', async () => {
    const pending = await prisma.file.findFirstOrThrow({
      where: { organizationId },
    });
    await repository.cancel(pending.id);

    expect(await repository.createPending(newFile(100), 100)).toEqual({
      created: true,
    });
    expect((await repository.find(pending.id))!.deletedAt).not.toBeNull();
  });

  it('marks a file ready once, keeping its first dimensions', async () => {
    const file = newFile(1);
    await prisma.file.create({ data: file });

    expect(
      await repository.markReady(file.id, { width: 10, height: 20 })
    ).toMatchObject({
      status: 'ready',
      width: 10,
      height: 20,
    });
    expect(
      await repository.markReady(file.id, { width: 1, height: 1 })
    ).toMatchObject({ width: 10 });
  });
});
