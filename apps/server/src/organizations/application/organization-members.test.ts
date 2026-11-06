import type { WorkspaceRole } from '@conduit/contract';
import type { AuthService } from '@thallesp/nestjs-better-auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Auth, auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';
import { BetterAuthOrganizationsGateway } from '@/organizations/infrastructure/better-auth-organizations.gateway';
import { createUser, signIn } from '@/shared/testing/auth-session';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { OrganizationsService } from './organizations.service';

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('OrganizationsService members', () => {
  const members = new PrismaWorkspaceMembersRepository(prisma);
  const service = new OrganizationsService(
    new BetterAuthOrganizationsGateway({ api: auth.api } as AuthService<Auth>),
    members
  );
  const userIds: string[] = [];
  let organizationId: string;
  let ownerHeaders: Headers;
  const people = {} as Record<
    'owner' | 'admin' | 'member' | 'other',
    { userId: string; memberId: string; headers: Headers }
  >;

  const viewerOf = (
    name: keyof typeof people,
    workspaceRole: WorkspaceRole
  ) => ({
    userId: people[name].userId,
    organizationId,
    workspaceRole,
  });

  beforeAll(async () => {
    const run = crypto.randomUUID().slice(0, 8);
    const owner = await createUser('owner');
    userIds.push(owner.id);
    ownerHeaders = await signIn(owner.email);

    const organization = await auth.api.createOrganization({
      body: { name: 'Acme', slug: `acme-${run}` },
      headers: ownerHeaders,
    });
    organizationId = organization.id;

    const join = async (
      name: keyof typeof people,
      user: { id: string; email: string },
      role: 'owner' | 'admin' | 'member'
    ) => {
      const member =
        name === 'owner'
          ? await prisma.member.findFirstOrThrow({
              where: { organizationId, userId: user.id },
            })
          : await auth.api.addMember({
              body: { userId: user.id, role, organizationId },
            });
      people[name] = {
        userId: user.id,
        memberId: member.id,
        headers: await signIn(user.email),
      };
    };

    await join('owner', owner, 'owner');
    for (const [name, role] of [
      ['admin', 'admin'],
      ['member', 'member'],
      ['other', 'member'],
    ] as const) {
      const user = await createUser(name);
      userIds.push(user.id);
      await join(name, user, role);
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('lets an admin promote a member to admin', async () => {
    await service.updateMemberRole(
      people.admin.headers,
      viewerOf('admin', 'admin'),
      people.member.memberId,
      'admin'
    );

    expect(await members.findRole(organizationId, people.member.userId)).toBe(
      'admin'
    );
  });

  it('refuses an admin who changes an owner', async () => {
    await expect(
      service.updateMemberRole(
        people.admin.headers,
        viewerOf('admin', 'admin'),
        people.owner.memberId,
        'member'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses to demote the last owner', async () => {
    await expect(
      service.updateMemberRole(
        people.owner.headers,
        viewerOf('owner', 'owner'),
        people.owner.memberId,
        'admin'
      )
    ).rejects.toMatchObject({ code: 'LAST_OWNER' });
  });

  it('refuses to remove the last owner', async () => {
    await expect(
      service.removeMember(
        people.admin.headers,
        viewerOf('admin', 'admin'),
        people.owner.memberId
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('removes a member and their channel memberships', async () => {
    const channelRows = () =>
      prisma.channelMember.count({
        where: { userId: people.other.userId, channel: { organizationId } },
      });
    expect(await channelRows()).toBeGreaterThan(0);

    await service.removeMember(
      people.admin.headers,
      viewerOf('admin', 'admin'),
      people.other.memberId
    );

    expect(await members.findRole(organizationId, people.other.userId)).toBe(
      null
    );
    expect(await channelRows()).toBe(0);
  });

  it('reports a member that is not in the workspace', async () => {
    await expect(
      service.removeMember(
        people.admin.headers,
        viewerOf('admin', 'admin'),
        people.other.memberId
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
