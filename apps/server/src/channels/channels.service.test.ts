import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/database/prisma.service';

import { ChannelsService, type ChannelViewer } from './channels.service';
import { ensureDefaultChannel } from './default-channel';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('ChannelsService', () => {
  const service = new ChannelsService();
  const run = crypto.randomUUID();
  const organization = { id: run, name: 'Acme', slug: `acme-${run}` };
  const otherOrganizationId = `${run}-other`;
  const users = {
    owner: `${run}-owner`,
    admin: `${run}-admin`,
    member: `${run}-member`,
    stranger: `${run}-stranger`,
  };
  const viewer = (
    userId: string,
    workspaceRole: ChannelViewer['workspaceRole']
  ): ChannelViewer => ({
    userId,
    organizationId: organization.id,
    workspaceRole,
  });
  const owner = viewer(users.owner, 'owner');
  const admin = viewer(users.admin, 'admin');
  const member = viewer(users.member, 'member');
  let defaultChannelId: string;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: Object.values(users).map((id) => ({
        id,
        name: id,
        email: `${id}@test.local`,
      })),
    });
    await prisma.organization.createMany({
      data: [
        { ...organization, createdAt: new Date() },
        {
          id: otherOrganizationId,
          name: 'Other',
          slug: `other-${run}`,
          createdAt: new Date(),
        },
      ],
    });
    await prisma.member.createMany({
      data: [
        { userId: users.owner, role: 'owner' },
        { userId: users.admin, role: 'admin' },
        { userId: users.member, role: 'member' },
      ].map((m) => ({
        ...m,
        organizationId: organization.id,
        createdAt: new Date(),
      })),
    });
    await prisma.member.create({
      data: {
        userId: users.stranger,
        organizationId: otherOrganizationId,
        role: 'owner',
        createdAt: new Date(),
      },
    });
    await ensureDefaultChannel(prisma, organization, [
      users.owner,
      users.admin,
      users.member,
    ]);
    defaultChannelId = (
      await prisma.channel.findUniqueOrThrow({
        where: { defaultForOrganizationId: organization.id },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [organization.id, otherOrganizationId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it('lists the default channel with the member as MEMBER', async () => {
    const channels = await service.list(member);
    const defaultChannel = channels.find((c) => c.isDefault);
    expect(defaultChannel?.membership?.role).toBe('member');
    expect(defaultChannel?.memberCount).toBe(3);
  });

  it('creates a channel with the creator as manager and refuses a duplicate name', async () => {
    const channel = await service.create(member, {
      name: 'design',
      visibility: 'public',
    });
    expect(channel.membership?.role).toBe('manager');
    expect(channel.memberCount).toBe(1);
    await expect(
      service.create(owner, { name: 'design', visibility: 'public' })
    ).rejects.toMatchObject({ code: 'NAME_TAKEN' });
  });

  it('renames as manager and maps a taken name', async () => {
    const channel = await service.create(member, {
      name: 'to-rename',
      visibility: 'public',
    });
    await expect(
      service.rename(member, channel.id, 'renamed')
    ).resolves.toMatchObject({ name: 'renamed' });
    await expect(
      service.rename(member, channel.id, 'design')
    ).rejects.toMatchObject({ code: 'NAME_TAKEN' });
  });

  it('lets an admin rename the default channel and refuses a member', async () => {
    await expect(
      service.rename(admin, defaultChannelId, 'general')
    ).resolves.toMatchObject({ name: 'general', isDefault: true });
    await expect(
      service.rename(member, defaultChannelId, 'mine')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses to delete or leave the default channel', async () => {
    await expect(service.delete(owner, defaultChannelId)).rejects.toMatchObject(
      { code: 'DEFAULT_CHANNEL_LOCKED' }
    );
    await expect(service.leave(member, defaultChannelId)).rejects.toMatchObject(
      { code: 'DEFAULT_CHANNEL_LOCKED' }
    );
  });

  it('joins and leaves a public channel', async () => {
    const channel = await service.create(owner, {
      name: 'join-me',
      visibility: 'public',
    });
    const joined = await service.join(member, channel.id);
    expect(joined.membership?.role).toBe('member');
    expect(joined.memberCount).toBe(2);
    await service.leave(member, channel.id);
    await expect(service.get(users.member, channel.id)).resolves.toMatchObject({
      membership: null,
      memberCount: 1,
    });
  });

  it('deletes only as an admin', async () => {
    const channel = await service.create(member, {
      name: 'doomed',
      visibility: 'public',
    });
    await expect(service.delete(member, channel.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await service.delete(owner, channel.id);
    await expect(service.get(users.owner, channel.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('hides a private channel from a non-member', async () => {
    const secret = await service.create(owner, {
      name: 'secret',
      visibility: 'private',
    });
    expect((await service.list(member)).map((c) => c.id)).not.toContain(
      secret.id
    );
    await expect(service.get(users.member, secret.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.join(member, secret.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('resolves get only in workspaces the caller belongs to', async () => {
    await expect(
      service.get(users.owner, defaultChannelId)
    ).resolves.toMatchObject({ organizationId: organization.id });
    await expect(
      service.get(users.stranger, defaultChannelId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not count stale rows of someone who left the workspace', async () => {
    const channel = await service.create(owner, {
      name: 'stale',
      visibility: 'public',
    });
    await service.join(admin, channel.id);
    await prisma.member.deleteMany({
      where: { organizationId: organization.id, userId: users.admin },
    });
    await expect(service.get(users.owner, channel.id)).resolves.toMatchObject({
      memberCount: 1,
    });
    await expect(service.get(users.admin, channel.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
