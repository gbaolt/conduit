import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ensureDefaultChannel } from '@/channels/infrastructure/default-channel';
import { PrismaChannelSectionsRepository } from '@/channels/infrastructure/prisma-channel-sections.repository';
import { prisma } from '@/infrastructure/database/prisma.service';
import {
  RoomsService,
  type RoomViewer,
} from '@/rooms/application/rooms.service';
import { PrismaRoomsRepository } from '@/rooms/infrastructure/prisma-rooms.repository';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';
import { PrismaWorkspaceSettingsRepository } from '@/workspaces/infrastructure/prisma-workspace-settings.repository';

import { ChannelsService } from './channels.service';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('ChannelsService', () => {
  const settings = new PrismaWorkspaceSettingsRepository(prisma);
  const rooms = new RoomsService(
    new PrismaRoomsRepository(prisma),
    new PrismaWorkspaceMembersRepository(prisma)
  );
  const service = new ChannelsService(
    new PrismaRoomsRepository(prisma),
    new PrismaChannelSectionsRepository(prisma),
    new PrismaWorkspaceMembersRepository(prisma),
    settings,
    rooms
  );
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
    workspaceRole: RoomViewer['workspaceRole']
  ): RoomViewer => ({
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
      await prisma.room.findUniqueOrThrow({
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
    await expect(rooms.get(users.member, channel.id)).resolves.toMatchObject({
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
    await expect(rooms.get(users.owner, channel.id)).rejects.toMatchObject({
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
    await expect(rooms.get(users.member, secret.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.join(member, secret.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('resolves get only in workspaces the caller belongs to', async () => {
    await expect(
      rooms.get(users.owner, defaultChannelId)
    ).resolves.toMatchObject({ organizationId: organization.id });
    await expect(
      rooms.get(users.stranger, defaultChannelId)
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
    await expect(rooms.get(users.owner, channel.id)).resolves.toMatchObject({
      memberCount: 1,
    });
    await expect(rooms.get(users.admin, channel.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  describe('details and members', () => {
    it('sets and clears the topic and description, and refuses someone outside the channel', async () => {
      const channel = await service.create(member, {
        name: 'details',
        visibility: 'public',
      });
      await expect(
        service.update(member, channel.id, {
          topic: ' Weekly design crits ',
          description: 'Where we review work',
        })
      ).resolves.toMatchObject({
        topic: 'Weekly design crits',
        description: 'Where we review work',
      });
      await expect(
        service.update(member, channel.id, { topic: '' })
      ).resolves.toMatchObject({
        topic: null,
        description: 'Where we review work',
      });
      await expect(
        service.update(owner, channel.id, { description: null })
      ).resolves.toMatchObject({ description: null });
      await expect(
        service.update(viewer(users.stranger, 'member'), channel.id, {
          topic: 'x',
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('lists members with managers first and hides stale rows', async () => {
      const channel = await service.create(owner, {
        name: 'roster',
        visibility: 'public',
      });
      await service.join(member, channel.id);
      await service.join(admin, channel.id);
      await prisma.member.deleteMany({
        where: { organizationId: organization.id, userId: users.admin },
      });
      const members = await rooms.listMembers(member, channel.id);
      expect(members.map((m) => [m.userId, m.role])).toEqual([
        [users.owner, 'manager'],
        [users.member, 'member'],
      ]);
      expect(members[0]).toMatchObject({ name: users.owner, image: null });
      await prisma.member.create({
        data: {
          userId: users.admin,
          organizationId: organization.id,
          role: 'admin',
          createdAt: new Date(),
        },
      });
    });

    it('adds only workspace members and refuses the default channel', async () => {
      const channel = await service.create(owner, {
        name: 'secret-add',
        visibility: 'private',
      });
      await expect(
        service.addMembers(owner, channel.id, [users.stranger])
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        service.addMembers(owner, defaultChannelId, [users.member])
      ).rejects.toMatchObject({ code: 'DEFAULT_CHANNEL_LOCKED' });
      await service.addMembers(owner, channel.id, [users.member, users.member]);
      await expect(rooms.get(users.member, channel.id)).resolves.toMatchObject({
        membership: { role: 'member' },
        memberCount: 2,
      });
    });

    it('writes a room-add item for each member added now, and none for one already in', async () => {
      const channel = await service.create(owner, {
        name: 'add-items',
        visibility: 'private',
      });
      const itemsFor = (userId: string) =>
        prisma.activityItem.findMany({
          where: { roomId: channel.id, userId, kind: 'ROOM_ADD' },
        });

      await service.addMembers(owner, channel.id, [users.member]);
      await service.addMembers(owner, channel.id, [users.member]);
      await service.addMembers(owner, channel.id, [users.owner]);

      expect(await itemsFor(users.member)).toEqual([
        expect.objectContaining({ actorId: users.owner }),
      ]);
      expect(await itemsFor(users.owner)).toHaveLength(0);
    });

    it('removes someone else, but not the caller or from the default channel', async () => {
      const channel = await service.create(owner, {
        name: 'remove-me',
        visibility: 'public',
      });
      await service.addMembers(owner, channel.id, [users.member]);
      await expect(
        service.removeMember(member, channel.id, users.owner)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        service.removeMember(owner, channel.id, users.owner)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        service.removeMember(owner, defaultChannelId, users.member)
      ).rejects.toMatchObject({ code: 'DEFAULT_CHANNEL_LOCKED' });
      await service.removeMember(owner, channel.id, users.member);
      await expect(
        service.removeMember(owner, channel.id, users.member)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('sets roles, refuses to demote the last manager, and locks the default channel', async () => {
      const channel = await service.create(owner, {
        name: 'roles',
        visibility: 'public',
      });
      await service.addMembers(owner, channel.id, [users.member]);
      await expect(
        service.setMemberRole(owner, channel.id, users.owner, 'member')
      ).rejects.toMatchObject({ code: 'LAST_MANAGER' });
      await service.setMemberRole(owner, channel.id, users.member, 'manager');
      await service.setMemberRole(member, channel.id, users.owner, 'member');
      await expect(
        service.setMemberRole(member, channel.id, users.member, 'member')
      ).rejects.toMatchObject({ code: 'LAST_MANAGER' });
      await expect(
        service.setMemberRole(owner, defaultChannelId, users.member, 'manager')
      ).rejects.toMatchObject({ code: 'DEFAULT_CHANNEL_LOCKED' });
    });
  });

  it('archives a channel, keeps its name reserved, and refuses writes', async () => {
    const channel = await service.create(member, {
      name: 'archive-me',
      visibility: 'public',
    });
    const archived = await service.archive(member, channel.id);
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.archivedByName).toBe(users.member);

    expect((await service.list(member)).map((c) => c.id)).not.toContain(
      channel.id
    );
    expect((await service.list(member, true)).map((c) => c.id)).toContain(
      channel.id
    );
    await expect(rooms.get(users.member, channel.id)).resolves.toMatchObject({
      archivedAt: expect.any(Date),
    });
    await expect(
      service.rename(member, channel.id, 'renamed-archived')
    ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });
    await expect(service.join(owner, channel.id)).rejects.toMatchObject({
      code: 'CHANNEL_ARCHIVED',
    });
    await expect(
      service.create(owner, { name: 'archive-me', visibility: 'public' })
    ).rejects.toMatchObject({ code: 'NAME_TAKEN' });
  });

  it('unarchives only as an admin or manager, and only an archived channel', async () => {
    const channel = await service.create(owner, {
      name: 'unarchive-me',
      visibility: 'public',
    });
    await expect(service.unarchive(owner, channel.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await service.archive(owner, channel.id);
    await expect(service.unarchive(member, channel.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.unarchive(owner, channel.id)).resolves.toMatchObject({
      archivedAt: null,
      archivedByName: null,
    });
    expect((await service.list(member)).map((c) => c.id)).toContain(channel.id);
  });

  it('refuses to archive the default channel or an archived one', async () => {
    await expect(
      service.archive(owner, defaultChannelId)
    ).rejects.toMatchObject({ code: 'DEFAULT_CHANNEL_LOCKED' });
    const channel = await service.create(owner, {
      name: 'archive-twice',
      visibility: 'public',
    });
    await service.archive(owner, channel.id);
    await expect(service.archive(owner, channel.id)).rejects.toMatchObject({
      code: 'CHANNEL_ARCHIVED',
    });
  });

  it('lets a manager make a channel private but only an admin make it public', async () => {
    const channel = await service.create(member, {
      name: 'switch-me',
      visibility: 'public',
    });
    await expect(
      service.setVisibility(member, channel.id, 'private')
    ).resolves.toMatchObject({ visibility: 'private' });
    await expect(
      service.setVisibility(member, channel.id, 'public')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.setVisibility(owner, channel.id, 'public')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets an admin who is in a private channel make it public', async () => {
    const channel = await service.create(owner, {
      name: 'admin-switch',
      visibility: 'private',
    });
    await expect(
      service.setVisibility(owner, channel.id, 'public')
    ).resolves.toMatchObject({ visibility: 'public' });
  });

  it('refuses to change the default channel visibility', async () => {
    await expect(
      service.setVisibility(owner, defaultChannelId, 'private')
    ).rejects.toMatchObject({ code: 'DEFAULT_CHANNEL_LOCKED' });
  });

  describe('who can create channels', () => {
    afterAll(() =>
      prisma.workspaceSettings.deleteMany({
        where: { organizationId: organization.id },
      })
    );

    it('refuses a member a public channel when public creation is admins only', async () => {
      await settings.update(organization.id, {
        publicChannelCreators: 'admins',
      });

      await expect(
        service.create(member, { name: 'forced-public', visibility: 'public' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const priv = await service.create(member, {
        name: 'quiet-private',
        visibility: 'private',
      });
      expect(priv.visibility).toBe('private');
      await expect(
        service.create(admin, { name: 'admin-public', visibility: 'public' })
      ).resolves.toBeDefined();
    });

    it('refuses a member every channel when creation is admins only', async () => {
      await settings.update(organization.id, {
        channelCreators: 'admins',
        publicChannelCreators: 'everyone',
      });

      await expect(
        service.create(member, { name: 'nope', visibility: 'private' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('lets everyone create again once the settings are reset', async () => {
      await settings.update(organization.id, {
        channelCreators: 'everyone',
        publicChannelCreators: 'everyone',
      });

      await expect(
        service.create(member, { name: 'open-again', visibility: 'public' })
      ).resolves.toBeDefined();
    });
  });
});
