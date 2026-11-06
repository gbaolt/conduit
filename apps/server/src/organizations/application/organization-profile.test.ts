import type { AuthService } from '@thallesp/nestjs-better-auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Auth, auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';
import type { InvitationsRepository } from '@/organizations/domain/invitations.repository';
import type { JoinAccessRepository } from '@/organizations/domain/join-access.repository';
import type { OrganizationsGateway } from '@/organizations/domain/organizations.gateway';
import { BetterAuthOrganizationsGateway } from '@/organizations/infrastructure/better-auth-organizations.gateway';
import { PrismaInvitationsRepository } from '@/organizations/infrastructure/prisma-invitations.repository';
import { PrismaJoinAccessRepository } from '@/organizations/infrastructure/prisma-join-access.repository';
import {
  createWorkspace,
  type Workspace,
} from '@/shared/testing/workspace-fixture';
import { fakeStorage } from '@/storage/testing/fake-object-storage';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { OrganizationsService } from './organizations.service';

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('OrganizationsService profile', () => {
  const service = new OrganizationsService(
    new BetterAuthOrganizationsGateway({ api: auth.api } as AuthService<Auth>),
    new PrismaWorkspaceMembersRepository(prisma),
    new PrismaInvitationsRepository(prisma),
    new PrismaJoinAccessRepository(prisma),
    fakeStorage
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

describe('OrganizationsService icon upload', () => {
  const service = new OrganizationsService(
    {} as OrganizationsGateway,
    {} as WorkspaceMembersRepository,
    {} as InvitationsRepository,
    {} as JoinAccessRepository,
    fakeStorage
  );
  const admin = {
    userId: 'u',
    organizationId: 'org1',
    workspaceRole: 'admin',
  } as const;
  const member = { ...admin, workspaceRole: 'member' } as const;
  const png = { contentType: 'image/png', size: 1000 };

  it('issues an unguessable key scoped to the workspace', async () => {
    const [a, b] = await Promise.all([
      service.iconUploadUrl(admin, png),
      service.iconUploadUrl(admin, png),
    ]);

    expect(a.uploadUrl).toMatch(
      /^https:\/\/upload\.test\/workspaces\/org1\/icons\/[0-9a-f-]{36}\.png$/
    );
    expect(a.publicUrl).not.toBe(b.publicUrl);
  });

  it('refuses a non-image content type', async () => {
    await expect(
      service.iconUploadUrl(admin, { contentType: 'text/html', size: 10 })
    ).rejects.toMatchObject({ code: 'INVALID_ICON' });
    await expect(
      service.iconUploadUrl(admin, { contentType: 'image/svg+xml', size: 10 })
    ).rejects.toMatchObject({ code: 'INVALID_ICON' });
  });

  it('refuses a file over 1 MB', async () => {
    await expect(
      service.iconUploadUrl(admin, { ...png, size: 1024 * 1024 + 1 })
    ).rejects.toMatchObject({ code: 'INVALID_ICON' });
    await expect(
      service.iconUploadUrl(admin, { ...png, size: 1024 * 1024 })
    ).resolves.toBeDefined();
  });

  it('refuses a member', async () => {
    await expect(service.iconUploadUrl(member, png)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('accepts only a logo this workspace uploaded', async () => {
    const gateway = {
      update: (_h: Headers, _id: string, input: object) =>
        Promise.resolve(input),
    } as Partial<OrganizationsGateway> as OrganizationsGateway;
    const svc = new OrganizationsService(
      gateway,
      {} as WorkspaceMembersRepository,
      {} as InvitationsRepository,
      {} as JoinAccessRepository,
      fakeStorage
    );

    await expect(
      svc.update(new Headers(), admin, { logo: 'https://evil.test/x.png' })
    ).rejects.toMatchObject({ code: 'INVALID_ICON' });
    await expect(
      svc.update(new Headers(), admin, {
        logo: 'https://cdn.test/workspaces/org2/icons/x.png',
      })
    ).rejects.toMatchObject({ code: 'INVALID_ICON' });
    await expect(
      svc.update(new Headers(), admin, {
        logo: 'https://cdn.test/workspaces/org1/icons/x.png',
      })
    ).resolves.toBeDefined();
  });
});
