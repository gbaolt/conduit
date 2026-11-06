import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { WorkspaceMembersService } from './workspace-members.service';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('WorkspaceMembersService', () => {
  const repository = new PrismaWorkspaceMembersRepository(prisma);
  const service = new WorkspaceMembersService(repository);
  const run = crypto.randomUUID();
  const organizationId = `${run}-org`;
  const users = { owner: `${run}-owner`, member: `${run}-member` };

  beforeAll(async () => {
    await prisma.user.createMany({
      data: Object.entries(users).map(([role, id]) => ({
        id,
        name: role,
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
    await prisma.member.createMany({
      data: Object.entries(users).map(([role, userId]) => ({
        id: `${userId}-m`,
        organizationId,
        userId,
        role,
        createdAt: new Date(),
      })),
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
  });

  it('lists every member with their user details', async () => {
    const members = await service.list(organizationId);

    expect(
      members.map(({ memberId, name, email, role, status }) => ({
        memberId,
        name,
        email,
        role,
        status,
      }))
    ).toEqual(
      expect.arrayContaining([
        {
          memberId: `${users.owner}-m`,
          name: 'owner',
          email: `${users.owner}@test.local`,
          role: 'owner',
          status: 'active',
        },
        {
          memberId: `${users.member}-m`,
          name: 'member',
          email: `${users.member}@test.local`,
          role: 'member',
          status: 'active',
        },
      ])
    );
    expect(members).toHaveLength(2);
  });
});
