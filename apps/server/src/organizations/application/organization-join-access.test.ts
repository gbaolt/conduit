import type { AuthService } from '@thallesp/nestjs-better-auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Auth, auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';
import { BetterAuthOrganizationsGateway } from '@/organizations/infrastructure/better-auth-organizations.gateway';
import { PrismaInvitationsRepository } from '@/organizations/infrastructure/prisma-invitations.repository';
import { PrismaJoinAccessRepository } from '@/organizations/infrastructure/prisma-join-access.repository';
import { createUser, signIn } from '@/shared/testing/auth-session';
import {
  createWorkspace,
  type Workspace,
} from '@/shared/testing/workspace-fixture';
import { fakeStorage } from '@/storage/testing/fake-object-storage';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { OrganizationsService } from './organizations.service';

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('OrganizationsService join access', () => {
  const members = new PrismaWorkspaceMembersRepository(prisma);
  const service = new OrganizationsService(
    new BetterAuthOrganizationsGateway({ api: auth.api } as AuthService<Auth>),
    members,
    new PrismaInvitationsRepository(prisma),
    new PrismaJoinAccessRepository(prisma),
    fakeStorage
  );
  let workspace: Workspace;
  const extraUserIds: string[] = [];
  const admin = () => ({
    userId: workspace.people.admin.userId,
    organizationId: workspace.organizationId,
    workspaceRole: 'admin' as const,
  });
  const memberRows = (userId: string) =>
    prisma.member.count({
      where: { organizationId: workspace.organizationId, userId },
    });
  const newcomer = async (label: string) => {
    const user = await createUser(label);
    extraUserIds.push(user.id);
    return {
      ...user,
      emailVerified: true,
      headers: await signIn(user.email),
    };
  };

  beforeAll(async () => {
    workspace = await createWorkspace();
  });

  afterAll(async () => {
    await workspace.cleanup();
    await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
  });

  describe('join link', () => {
    it('gives an admin the same link on every read and refuses a member', async () => {
      const first = await service.getJoinLink(admin());
      const second = await service.getJoinLink(admin());

      expect(first.token).toBe(second.token);
      expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
      await expect(
        service.getJoinLink({ ...admin(), workspaceRole: 'member' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('previews only the workspace name and logo', async () => {
      const { token } = await service.getJoinLink(admin());

      expect(await service.previewJoinLink(token)).toEqual({
        organizationName: 'Acme',
        logo: null,
      });
    });

    it('joins a new user as a member and puts them in the default channel', async () => {
      const user = await newcomer('joiner');
      const { token } = await service.getJoinLink(admin());

      await service.joinWithLink(user.headers, user.id, token);

      expect(await members.findRole(workspace.organizationId, user.id)).toBe(
        'member'
      );
      expect(
        await prisma.roomMember.count({
          where: {
            userId: user.id,
            room: { organizationId: workspace.organizationId },
          },
        })
      ).toBeGreaterThan(0);
    });

    it('leaves one member row when the same user joins twice', async () => {
      const user = await newcomer('twice');
      const { token } = await service.getJoinLink(admin());

      await service.joinWithLink(user.headers, user.id, token);
      await service.joinWithLink(user.headers, user.id, token);

      expect(await memberRows(user.id)).toBe(1);
    });

    it('refuses a reset token and accepts the new one', async () => {
      const user = await newcomer('reset');
      const { token: old } = await service.getJoinLink(admin());

      const { token } = await service.resetJoinLink(admin());

      expect(token).not.toBe(old);
      await expect(
        service.joinWithLink(user.headers, user.id, old)
      ).rejects.toMatchObject({ code: 'JOIN_LINK_INVALID' });
      await expect(service.previewJoinLink(old)).rejects.toMatchObject({
        code: 'JOIN_LINK_INVALID',
      });
      await service.joinWithLink(user.headers, user.id, token);
      expect(await memberRows(user.id)).toBe(1);
    });

    it('refuses a deactivated member', async () => {
      const { token } = await service.getJoinLink(admin());
      const { userId, memberId, headers } = workspace.people.other;
      await members.deactivate(memberId, workspace.people.owner.userId);

      await expect(
        service.joinWithLink(headers, userId, token)
      ).rejects.toMatchObject({ code: 'DEACTIVATED' });
    });
  });

  describe('allowed domains', () => {
    const domain = 'test.local';

    it('stores lower-cased domains and refuses a public mail domain', async () => {
      expect(
        await service.setAllowedDomains(admin(), ['Eng.Acme.dev', 'ACME.dev'])
      ).toEqual(['acme.dev', 'eng.acme.dev']);

      await expect(
        service.setAllowedDomains(admin(), ['acme.dev', 'GMAIL.com'])
      ).rejects.toMatchObject({ code: 'PUBLIC_MAIL_DOMAIN' });
      expect(await service.listAllowedDomains(admin())).toEqual([
        'acme.dev',
        'eng.acme.dev',
      ]);
    });

    it('lists and joins a verified user at the domain', async () => {
      await service.setAllowedDomains(admin(), [domain]);
      const user = await newcomer('domain');

      const listed = await service.listJoinable(user);
      expect(listed.map(({ id }) => id)).toEqual([workspace.organizationId]);

      await service.joinOrganization(
        user.headers,
        user,
        workspace.organizationId
      );

      expect(await memberRows(user.id)).toBe(1);
      expect(await service.listJoinable(user)).toEqual([]);
    });

    it('neither lists nor joins an unverified user', async () => {
      await service.setAllowedDomains(admin(), [domain]);
      const user = { ...(await newcomer('unverified')), emailVerified: false };

      expect(await service.listJoinable(user)).toEqual([]);
      await expect(
        service.joinOrganization(user.headers, user, workspace.organizationId)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(await memberRows(user.id)).toBe(0);
    });

    it('does not match a subdomain of an allowed domain', async () => {
      await service.setAllowedDomains(admin(), [domain]);
      const user = {
        ...(await newcomer('sub')),
        email: `sub@eng.${domain}`,
      };

      expect(await service.listJoinable(user)).toEqual([]);
      await expect(
        service.joinOrganization(user.headers, user, workspace.organizationId)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('does not list a workspace the user is deactivated in', async () => {
      await service.setAllowedDomains(admin(), [domain]);
      const { userId, memberId } = workspace.people.other;
      await members.deactivate(memberId, workspace.people.owner.userId);
      const { email } = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      expect(
        await service.listJoinable({ id: userId, email, emailVerified: true })
      ).toEqual([]);
    });
  });
});
