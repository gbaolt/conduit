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

describe.skipIf(!connectionString)('OrganizationsService profile', () => {
  const service = new OrganizationsService(
    new BetterAuthOrganizationsGateway({ api: auth.api } as AuthService<Auth>),
    new PrismaWorkspaceMembersRepository(prisma)
  );
  let workspace: Workspace;
  let other: Workspace;
  const viewer = (name: 'admin' | 'member') => ({
    userId: workspace.people[name].userId,
    organizationId: workspace.organizationId,
    workspaceRole: name,
  });

  beforeAll(async () => {
    [workspace, other] = await Promise.all([
      createWorkspace(),
      createWorkspace(),
    ]);
  });

  afterAll(() => Promise.all([workspace.cleanup(), other.cleanup()]));

  it('lets an admin rename the workspace and change its slug', async () => {
    const slug = `renamed-${crypto.randomUUID().slice(0, 8)}`;

    const updated = await service.update(
      workspace.people.admin.headers,
      viewer('admin'),
      { name: 'Renamed', slug }
    );

    expect(updated).toMatchObject({ name: 'Renamed', slug });
  });

  it('refuses a slug another workspace uses', async () => {
    const taken = await prisma.organization.findUniqueOrThrow({
      where: { id: other.organizationId },
    });

    await expect(
      service.update(workspace.people.admin.headers, viewer('admin'), {
        slug: taken.slug,
      })
    ).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
  });

  it('refuses a member', async () => {
    await expect(
      service.update(workspace.people.member.headers, viewer('member'), {
        name: 'Mine now',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
