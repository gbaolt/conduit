import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/database/prisma.service';
import { WorkspaceMembersRepository } from '@/workspaces/workspace-members.repository';

import { ChannelSectionsRepository } from './channel-sections.repository';
import {
  ChannelSectionsService,
  type SectionViewer,
} from './channel-sections.service';
import { ChannelsRepository } from './channels.repository';
import { ChannelsService, type ChannelViewer } from './channels.service';
import { ensureDefaultChannel } from './default-channel';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('star and sections', () => {
  const sectionsRepository = new ChannelSectionsRepository(prisma);
  const channels = new ChannelsService(
    new ChannelsRepository(prisma),
    sectionsRepository,
    new WorkspaceMembersRepository(prisma)
  );
  const sections = new ChannelSectionsService(sectionsRepository);
  const run = crypto.randomUUID();
  const organization = { id: run, name: 'Acme', slug: `acme-${run}` };
  const users = { owner: `${run}-owner`, member: `${run}-member` };
  const viewer = (
    userId: string,
    workspaceRole: ChannelViewer['workspaceRole']
  ): ChannelViewer & SectionViewer => ({
    userId,
    organizationId: organization.id,
    workspaceRole,
  });
  const owner = viewer(users.owner, 'owner');
  const member = viewer(users.member, 'member');
  let defaultChannelId: string;

  const membershipOf = async (v: ChannelViewer, channelId: string) =>
    (await channels.get(v.userId, channelId)).membership;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: Object.values(users).map((id) => ({
        id,
        name: id,
        email: `${id}@test.local`,
      })),
    });
    await prisma.organization.create({
      data: { ...organization, createdAt: new Date() },
    });
    await prisma.member.createMany({
      data: [
        { userId: users.owner, role: 'owner' },
        { userId: users.member, role: 'member' },
      ].map((m) => ({
        ...m,
        organizationId: organization.id,
        createdAt: new Date(),
      })),
    });
    await ensureDefaultChannel(prisma, organization, [
      users.owner,
      users.member,
    ]);
    defaultChannelId = (
      await prisma.channel.findUniqueOrThrow({
        where: { defaultForOrganizationId: organization.id },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it('stars and unstars only the caller’s own row, including the default channel', async () => {
    await channels.star(member, defaultChannelId);
    expect((await membershipOf(member, defaultChannelId))?.starredAt).toEqual(
      expect.any(Date)
    );
    expect((await membershipOf(owner, defaultChannelId))?.starredAt).toBeNull();
    await channels.unstar(member, defaultChannelId);
    expect(
      (await membershipOf(member, defaultChannelId))?.starredAt
    ).toBeNull();
  });

  it('refuses to star a channel the caller is not in', async () => {
    const channel = await channels.create(owner, {
      name: 'not-yours',
      visibility: 'public',
    });
    await expect(channels.star(member, channel.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const secret = await channels.create(owner, {
      name: 'secret',
      visibility: 'private',
    });
    await expect(channels.star(member, secret.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('creates, lists, renames and orders only the caller’s own sections', async () => {
    const first = await sections.create(member, 'Projects');
    const second = await sections.create(member, 'Later');
    expect(second.position).toBe(first.position + 1);
    await expect(sections.create(member, 'Projects')).rejects.toMatchObject({
      code: 'NAME_TAKEN',
    });
    await expect(sections.create(owner, 'Projects')).resolves.toBeDefined();

    await expect(
      sections.rename(member, second.id, 'Soon')
    ).resolves.toMatchObject({ name: 'Soon' });
    await sections.reorder(member, [second.id, first.id]);
    expect((await sections.list(member)).map((s) => s.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('treats another user’s section as missing', async () => {
    const theirs = await sections.create(owner, 'Owner only');
    const channel = await channels.create(member, {
      name: 'mine',
      visibility: 'public',
    });

    expect(await sections.list(member)).not.toContainEqual(
      expect.objectContaining({ id: theirs.id })
    );
    await expect(
      sections.rename(member, theirs.id, 'Hijacked')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(sections.delete(member, theirs.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(sections.reorder(member, [theirs.id])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      channels.moveToSection(member, channel.id, theirs.id)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await membershipOf(member, channel.id))?.sectionId).toBeNull();
  });

  it('keeps a deleted section’s channels and sends them back to Channels', async () => {
    const section = await sections.create(member, 'Doomed');
    const channel = await channels.create(member, {
      name: 'stays',
      visibility: 'public',
    });
    await channels.moveToSection(member, channel.id, section.id);
    expect((await membershipOf(member, channel.id))?.sectionId).toBe(
      section.id
    );

    await sections.delete(member, section.id);
    expect((await membershipOf(member, channel.id))?.sectionId).toBeNull();
  });
});
