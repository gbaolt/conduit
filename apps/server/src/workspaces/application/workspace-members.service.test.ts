import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';
import {
  createWorkspace,
  type Workspace,
} from '@/shared/testing/workspace-fixture';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { WorkspaceMembersService } from './workspace-members.service';

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('WorkspaceMembersService', () => {
  const repository = new PrismaWorkspaceMembersRepository(prisma);
  const service = new WorkspaceMembersService(repository);
  let workspace: Workspace;
  const people = () => workspace.people;
  const viewer = (name: 'owner' | 'admin' | 'member') => ({
    userId: people()[name].userId,
    organizationId: workspace.organizationId,
    workspaceRole: name,
  });
  const roleOf = (name: keyof Workspace['people']) =>
    repository.findRole(workspace.organizationId, people()[name].userId);

  beforeAll(async () => {
    workspace = await createWorkspace();
  });

  afterAll(() => workspace.cleanup());

  it('lists every member with their user details', async () => {
    const members = await service.list(workspace.organizationId);

    expect(
      members.map(({ userId, name, role, status }) => ({
        userId,
        name,
        role,
        status,
      }))
    ).toEqual(
      expect.arrayContaining([
        {
          userId: people().owner.userId,
          name: 'owner',
          role: 'owner',
          status: 'active',
        },
        {
          userId: people().member.userId,
          name: 'member',
          role: 'member',
          status: 'active',
        },
      ])
    );
    expect(members).toHaveLength(4);
  });

  it('refuses a plain member, and an admin acting on an owner', async () => {
    await expect(
      service.deactivate(viewer('member'), people().other.memberId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.deactivate(viewer('admin'), people().owner.memberId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('deactivates a member, and reactivation restores their access', async () => {
    await service.deactivate(viewer('admin'), people().other.memberId);

    expect(await roleOf('other')).toBeNull();
    expect(
      await repository.isDeactivated(
        workspace.organizationId,
        people().other.userId
      )
    ).toBe(true);
    expect(
      (await service.list(workspace.organizationId)).find(
        (member) => member.userId === people().other.userId
      )?.status
    ).toBe('deactivated');
    // Deactivation keeps the channel memberships.
    expect(
      await prisma.channelMember.count({
        where: { userId: people().other.userId },
      })
    ).toBeGreaterThan(0);

    await service.reactivate(viewer('admin'), people().other.memberId);

    expect(await roleOf('other')).toBe('member');
  });

  it('deletes the deactivation row when the member is removed', async () => {
    await service.deactivate(viewer('admin'), people().other.memberId);
    const rows = () =>
      prisma.memberDeactivation.count({
        where: { memberId: people().other.memberId },
      });
    expect(await rows()).toBe(1);

    await auth.api.removeMember({
      body: {
        organizationId: workspace.organizationId,
        memberIdOrEmail: people().other.memberId,
      },
      headers: people().owner.headers,
    });

    expect(await rows()).toBe(0);
  });

  it('refuses Better Auth organization routes to a deactivated admin', async () => {
    const admin = people().admin;
    const invite = () =>
      auth.api.createInvitation({
        body: {
          email: `invitee-${crypto.randomUUID()}@test.local`,
          role: 'member',
          organizationId: workspace.organizationId,
        },
        headers: admin.headers,
      });

    await expect(invite()).resolves.toBeDefined();

    await service.deactivate(viewer('owner'), admin.memberId);

    await expect(invite()).rejects.toMatchObject({ status: 'FORBIDDEN' });
    await expect(
      auth.api.setActiveOrganization({
        body: { organizationId: workspace.organizationId },
        headers: admin.headers,
      })
    ).rejects.toMatchObject({ status: 'FORBIDDEN' });
  });
});
