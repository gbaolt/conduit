import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaRoomsRepository } from './prisma-rooms.repository';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaRoomsRepository', () => {
  const repository = new PrismaRoomsRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const otherOrganizationId = `${run}-other`;
  const [viewer, a, b] = ['viewer', 'a', 'b'].map((name) => `${run}-${name}`);
  const room = (name: string) => `${run}-${name}`;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [viewer!, a!, b!].map((id) => ({
        id,
        name: id,
        email: `${id}@test.local`,
      })),
    });
    await prisma.organization.createMany({
      data: [organizationId, otherOrganizationId].map((id) => ({
        id,
        name: 'Acme',
        slug: `acme-${id}`,
        createdAt: new Date(),
      })),
    });
    await prisma.room.createMany({
      data: [
        { id: room('general'), organizationId, name: 'general' },
        {
          id: room('archived'),
          organizationId,
          name: 'old',
          archivedAt: new Date(),
        },
        {
          id: room('secret'),
          organizationId,
          name: 'secret',
          visibility: 'PRIVATE',
        },
        {
          id: room('mine'),
          organizationId,
          name: 'mine',
          visibility: 'PRIVATE',
        },
        {
          id: room('their-dm'),
          organizationId,
          name: `${run}:ab`,
          kind: 'DM',
          visibility: 'PRIVATE',
        },
        {
          id: room('my-dm'),
          organizationId,
          name: `${run}:va`,
          kind: 'DM',
          visibility: 'PRIVATE',
        },
        {
          id: room('elsewhere'),
          organizationId: otherOrganizationId,
          name: 'general',
        },
      ],
    });
    await prisma.roomMember.createMany({
      data: [
        { roomId: room('secret'), userId: a! },
        { roomId: room('mine'), userId: viewer! },
        { roomId: room('their-dm'), userId: a! },
        { roomId: room('their-dm'), userId: b! },
        { roomId: room('my-dm'), userId: viewer! },
        { roomId: room('my-dm'), userId: a! },
        { roomId: room('elsewhere'), userId: viewer! },
      ],
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [organizationId, otherOrganizationId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [viewer!, a!, b!] } } });
    await prisma.$disconnect();
  });

  it("lists public channels, archived ones too, and the viewer's own private rooms, in this workspace only", async () => {
    const ids = await repository.accessibleRoomIds({
      userId: viewer!,
      organizationId,
    });

    expect(ids.sort()).toEqual(
      [room('general'), room('archived'), room('mine'), room('my-dm')].sort()
    );
  });
});
