import type { AuthService } from '@thallesp/nestjs-better-auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Auth, auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';
import { BetterAuthOrganizationsGateway } from '@/organizations/infrastructure/better-auth-organizations.gateway';
import { PrismaInvitationsRepository } from '@/organizations/infrastructure/prisma-invitations.repository';
import {
  createWorkspace,
  type Workspace,
} from '@/shared/testing/workspace-fixture';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { OrganizationsService } from './organizations.service';

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('OrganizationsService invitations', () => {
  const service = new OrganizationsService(
    new BetterAuthOrganizationsGateway({ api: auth.api } as AuthService<Auth>),
    new PrismaWorkspaceMembersRepository(prisma),
    new PrismaInvitationsRepository(prisma)
  );
  let workspace: Workspace;
  const admin = () => ({
    userId: workspace.people.admin.userId,
    organizationId: workspace.organizationId,
    workspaceRole: 'admin' as const,
  });
  const memberEmail = async () =>
    (
      await prisma.user.findUniqueOrThrow({
        where: { id: workspace.people.member.userId },
      })
    ).email;
  const newEmail = `new-${crypto.randomUUID()}@test.local`;

  beforeAll(async () => {
    workspace = await createWorkspace();
  });

  afterAll(() => workspace.cleanup());

  it('sends an invitation to a new address and skips an existing member', async () => {
    const existing = await memberEmail();

    const result = await service.inviteToWorkspace(
      workspace.people.admin.headers,
      admin(),
      [newEmail.toUpperCase(), existing, newEmail],
      'member'
    );

    expect(result).toEqual({
      sent: [newEmail],
      skipped: [{ email: existing, reason: 'member' }],
    });
  });

  it('skips an address that already has a pending invitation', async () => {
    const result = await service.inviteToWorkspace(
      workspace.people.admin.headers,
      admin(),
      [newEmail],
      'admin'
    );

    expect(result.skipped).toEqual([{ email: newEmail, reason: 'invited' }]);
  });

  it('refuses a plain member', async () => {
    await expect(
      service.inviteToWorkspace(
        workspace.people.member.headers,
        { ...admin(), workspaceRole: 'member' },
        [`x-${newEmail}`],
        'member'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('revokes an invitation and stops listing it', async () => {
    const [pending] = await service.listWorkspaceInvitations(admin());
    expect(pending).toMatchObject({ email: newEmail, inviterName: 'admin' });

    await service.revokeInvitation(
      workspace.people.admin.headers,
      admin(),
      pending!.id
    );

    expect(await service.listWorkspaceInvitations(admin())).toEqual([]);
    await expect(service.previewInvitation(pending!.id)).rejects.toMatchObject({
      code: 'INVITATION_NOT_FOUND',
    });
    await expect(
      service.revokeInvitation(
        workspace.people.admin.headers,
        admin(),
        pending!.id
      )
    ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
  });

  it('does not revoke an invitation of another workspace', async () => {
    const other = await createWorkspace();
    try {
      const otherAdmin = {
        userId: other.people.admin.userId,
        organizationId: other.organizationId,
        workspaceRole: 'admin' as const,
      };
      await service.inviteToWorkspace(
        other.people.admin.headers,
        otherAdmin,
        [`other-${newEmail}`],
        'member'
      );
      const [foreign] = await service.listWorkspaceInvitations(otherAdmin);

      await expect(
        service.revokeInvitation(
          workspace.people.admin.headers,
          admin(),
          foreign!.id
        )
      ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
    } finally {
      await other.cleanup();
    }
  });
});
