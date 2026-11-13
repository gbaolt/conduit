import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PrismaWorkspaceMembershipRepository } from '@/channels/infrastructure/prisma-workspace-membership.repository';
import { prisma } from '@/infrastructure/database/prisma.service';

import { WorkspaceMembershipService } from './workspace-membership.service';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('WorkspaceMembershipService', () => {
  const service = new WorkspaceMembershipService(
    new PrismaWorkspaceMembershipRepository(prisma)
  );
  const run = crypto.randomUUID();
  const workspace = { id: run, name: 'Acme', slug: `acme-${run}` };
  const users = { leaving: `${run}-leaving`, staying: `${run}-staying` };

  const channelIdsOf = async (userId: string) =>
    (
      await prisma.roomMember.findMany({
        where: { userId, room: { organizationId: workspace.id } },
        select: { roomId: true },
      })
    ).map((row) => row.roomId);

  beforeAll(async () => {
    await prisma.user.createMany({
      data: Object.values(users).map((id) => ({
        id,
        name: id,
        email: `${id}@test.local`,
      })),
    });
    await prisma.organization.create({
      data: { ...workspace, createdAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: workspace.id } });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it('adds a joining member to the default channel once', async () => {
    await service.memberJoined(workspace, users.leaving);
    await service.memberJoined(workspace, users.leaving);
    await service.memberJoined(workspace, users.staying);

    expect(await channelIdsOf(users.leaving)).toHaveLength(1);
    expect(await channelIdsOf(users.staying)).toEqual(
      await channelIdsOf(users.leaving)
    );
  });

  it('removes only the leaving member’s channels and sections', async () => {
    await prisma.channelSection.create({
      data: {
        userId: users.leaving,
        organizationId: workspace.id,
        name: 'Projects',
        position: 0,
      },
    });

    await service.memberRemoved(workspace.id, users.leaving);

    expect(await channelIdsOf(users.leaving)).toEqual([]);
    expect(
      await prisma.channelSection.count({
        where: { userId: users.leaving, organizationId: workspace.id },
      })
    ).toBe(0);
    expect(await channelIdsOf(users.staying)).toHaveLength(1);
  });
});
