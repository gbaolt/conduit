import type { WorkspaceRole } from '@conduit/contract';
import type { AuthService } from '@thallesp/nestjs-better-auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Auth, auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';
import { BetterAuthOrganizationsGateway } from '@/organizations/infrastructure/better-auth-organizations.gateway';
import {
  createWorkspace,
  type Workspace,
} from '@/shared/testing/workspace-fixture';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { OrganizationsService } from './organizations.service';

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('OrganizationsService members', () => {
  const members = new PrismaWorkspaceMembersRepository(prisma);
  const service = new OrganizationsService(
    new BetterAuthOrganizationsGateway({ api: auth.api } as AuthService<Auth>),
    members
  );
  let workspace: Workspace;
  const people = () => workspace.people;
  const viewerOf = (
    name: keyof Workspace['people'],
    workspaceRole: WorkspaceRole
  ) => ({
    userId: people()[name].userId,
    organizationId: workspace.organizationId,
    workspaceRole,
  });

  beforeAll(async () => {
    workspace = await createWorkspace();
  });

  afterAll(() => workspace.cleanup());

  it('lets an admin promote a member to admin', async () => {
    await service.updateMemberRole(
      people().admin.headers,
      viewerOf('admin', 'admin'),
      people().member.memberId,
      'admin'
    );

    expect(
      await members.findRole(workspace.organizationId, people().member.userId)
    ).toBe('admin');
  });

  it('refuses an admin who changes an owner', async () => {
    await expect(
      service.updateMemberRole(
        people().admin.headers,
        viewerOf('admin', 'admin'),
        people().owner.memberId,
        'member'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses to demote the last owner', async () => {
    await expect(
      service.updateMemberRole(
        people().owner.headers,
        viewerOf('owner', 'owner'),
        people().owner.memberId,
        'admin'
      )
    ).rejects.toMatchObject({ code: 'LAST_OWNER' });
  });

  it('refuses an admin who removes an owner', async () => {
    await expect(
      service.removeMember(
        people().admin.headers,
        viewerOf('admin', 'admin'),
        people().owner.memberId
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('removes a member and their channel memberships', async () => {
    const channelRows = () =>
      prisma.channelMember.count({
        where: {
          userId: people().other.userId,
          channel: { organizationId: workspace.organizationId },
        },
      });
    expect(await channelRows()).toBeGreaterThan(0);

    await service.removeMember(
      people().admin.headers,
      viewerOf('admin', 'admin'),
      people().other.memberId
    );

    expect(
      await members.findRole(workspace.organizationId, people().other.userId)
    ).toBe(null);
    expect(await channelRows()).toBe(0);
  });

  it('reports a member that is not in the workspace', async () => {
    await expect(
      service.removeMember(
        people().admin.headers,
        viewerOf('admin', 'admin'),
        people().other.memberId
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('hides a workspace from a user deactivated in it', async () => {
    const memberId = people().member.memberId;
    const userId = people().member.userId;
    await members.deactivate(memberId, people().owner.userId);

    const listed = await service.list(people().member.headers, userId);

    expect(listed.map(({ id }) => id)).not.toContain(workspace.organizationId);
  });
});
