import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';
import { PrismaMessagesRepository } from '@/messages/infrastructure/prisma-messages.repository';
import { NotificationSettingsService } from '@/notifications/application/notification-settings.service';
import { PrismaNotificationSettingsRepository } from '@/notifications/infrastructure/prisma-notification-settings.repository';
import { PrismaRoomsRepository } from '@/rooms/infrastructure/prisma-rooms.repository';
import { messageDocId } from '@/search/domain/search-doc';
import { PrismaSearchRepository } from '@/search/infrastructure/prisma-search.repository';
import { PrismaSearchSyncRepository } from '@/search/infrastructure/prisma-search-sync.repository';
import { createFakeSearchIndex } from '@/search/testing/fake-search-index';

import { SearchService } from './search.service';
import { SearchSyncService } from './search-sync.service';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('SearchService', () => {
  const run = crypto.randomUUID();
  const org = run;
  const otherOrg = `${run}-other`;
  const ana = `${run}-ana`;
  const bao = `${run}-bao`;
  const cy = `${run}-cy`;
  const room = (name: string) => `${run}-${name}`;
  const messages = new PrismaMessagesRepository(prisma);
  const { index, state } = createFakeSearchIndex();
  const sync = new SearchSyncService(
    new PrismaSearchSyncRepository(prisma),
    index,
    { extract: async () => '' }
  );
  const service = new SearchService(
    new PrismaSearchRepository(prisma),
    index,
    new PrismaRoomsRepository(prisma),
    new NotificationSettingsService(
      new PrismaNotificationSettingsRepository(prisma)
    )
  );
  const viewer = {
    userId: ana,
    organizationId: org,
    workspaceRole: 'member' as const,
  };
  const ids: Record<string, string> = {};
  const search = (text: string) => service.query(viewer, { text });
  const bodies = async (text: string) =>
    (await search(text)).messages.map((message) => message.body).sort();
  const mentions = { userIds: [], channel: false, here: false };

  const send = async (
    key: string,
    roomId: string,
    authorId: string,
    body: string,
    fileIds: string[] = []
  ) => {
    const { message } = await messages.send({
      roomId,
      authorId,
      clientId: key,
      body,
      mentions,
      fileIds,
      items: () => [],
    });
    ids[key] = message.id;
  };

  const readyFile = async (
    key: string,
    roomId: string,
    uploaderId: string,
    name: string,
    organizationId = org
  ) => {
    const id = `${run}-${key}`;
    await prisma.file.create({
      data: {
        id,
        organizationId,
        uploaderId,
        roomId,
        name,
        contentType: 'application/pdf',
        size: 10,
        key: `files/${id}`,
        status: 'READY',
      },
    });
    ids[key] = id;
    return id;
  };

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: ana, name: 'Ana Silva', email: `${ana}@test.local` },
        { id: bao, name: 'Bao Tran', email: `${bao}@test.local` },
        { id: cy, name: 'Cy Rao', email: `${cy}@test.local` },
      ],
    });
    for (const id of [org, otherOrg]) {
      await prisma.organization.create({
        data: { id, name: id, slug: `s-${id}`, createdAt: new Date() },
      });
    }
    await prisma.member.createMany({
      data: [ana, bao, cy].map((userId) => ({
        userId,
        organizationId: org,
        role: 'member',
        createdAt: new Date(),
      })),
    });
    const rooms = [
      { id: room('design'), name: `design-${run}`, members: [ana, bao] },
      // Public, and Ana isn't in it: still readable.
      { id: room('launch'), name: `launch-${run}`, members: [bao] },
      {
        id: room('secret'),
        name: `secret-${run}`,
        private: true,
        members: [bao, cy],
      },
      {
        id: room('mine'),
        name: `mine-${run}`,
        private: true,
        members: [ana, bao],
      },
      { id: room('dm-bc'), name: `dm-bc-${run}`, dm: true, members: [bao, cy] },
      {
        id: room('dm-ab'),
        name: `dm-ab-${run}`,
        dm: true,
        members: [ana, bao],
      },
    ];
    for (const spec of rooms) {
      await prisma.room.create({
        data: {
          id: spec.id,
          organizationId: org,
          name: spec.name,
          kind: spec.dm ? 'DM' : 'CHANNEL',
          visibility: spec.private || spec.dm ? 'PRIVATE' : 'PUBLIC',
          members: { create: spec.members.map((userId) => ({ userId })) },
        },
      });
    }
    await prisma.room.create({
      data: { id: room('elsewhere'), organizationId: otherOrg, name: 'x' },
    });

    await send('design', room('design'), bao, 'pricing in design');
    await send('launch', room('launch'), bao, 'pricing in launch');
    await send('secret', room('secret'), bao, 'pricing in secret');
    await send('mine', room('mine'), bao, 'pricing in mine');
    await send('dm-bc', room('dm-bc'), bao, 'pricing between bao and cy');
    await send('dm-ab', room('dm-ab'), bao, 'pricing between ana and bao');
    await send('deleted', room('design'), bao, 'pricing that was deleted');
    await send('ana', room('design'), ana, 'pricing from ana');
    const deck = await readyFile('deck', room('design'), bao, 'deck.pdf');
    await send('with-deck', room('design'), bao, 'the deck', [deck]);
    const hidden = await readyFile('hidden', room('secret'), bao, 'hidden.pdf');
    await send('with-hidden', room('secret'), bao, 'hidden file', [hidden]);
    await sync.drain(org, 100);

    // The index still holds both after this, as it would before it catches up.
    await prisma.message.update({
      where: { id: ids.deleted },
      data: { deletedAt: new Date() },
    });
    // A document for another workspace's message, wrongly in this namespace, still names a room Ana can't read.
    await prisma.message.create({
      data: {
        id: `${run}-foreign`,
        roomId: room('elsewhere'),
        authorId: bao,
        clientId: 'foreign',
        body: 'pricing elsewhere',
      },
    });
    await index.upsert(org, [
      {
        id: messageDocId(`${run}-foreign`),
        data: 'pricing elsewhere',
        metadata: {
          kind: 'message',
          roomId: room('elsewhere'),
          authorId: bao,
          createdAt: Date.now(),
          hasFile: 0,
        },
      },
    ]);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [org, otherOrg] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [ana, bao, cy] } } });
    await prisma.$disconnect();
  });

  it('returns only messages in rooms the caller can read, as Postgres holds them', async () => {
    expect(await bodies('pricing')).toEqual([
      'pricing between ana and bao',
      'pricing from ana',
      'pricing in design',
      'pricing in launch',
      'pricing in mine',
      // The fake index ignores the text, so every readable message is a hit.
      'the deck',
    ]);
  });

  it('returns only files the caller can read, and drops a deleted one', async () => {
    expect((await search('pdf')).files.map((file) => file.name)).toEqual([
      'deck.pdf',
    ]);

    await prisma.file.update({
      where: { id: ids.deck },
      data: { deletedAt: new Date() },
    });
    expect((await search('pdf')).files).toEqual([]);
    await prisma.file.update({
      where: { id: ids.deck },
      data: { deletedAt: null },
    });
  });

  it('returns nothing for an in: that names a private channel the caller is not in', async () => {
    const result = await search(`pricing in:#secret-${run}`);
    expect(result.messages).toEqual([]);
    expect(result.files).toEqual([]);
  });

  it('narrows to one channel, a DM, or an author', async () => {
    expect(await bodies(`pricing in:#DESIGN-${run}`)).toEqual([
      'pricing from ana',
      'pricing in design',
      'the deck',
    ]);
    expect(await bodies('pricing in:@bao')).toEqual([
      'pricing between ana and bao',
    ]);
    expect(await bodies('pricing from:@"Ana Silva"')).toEqual([
      'pricing from ana',
    ]);
    expect(await bodies('pricing from:@nobody')).toEqual([]);
  });

  it('lists the newest matches from Postgres when the query is filters alone', async () => {
    const result = await search('from:@bao has:file');
    expect(result.messages.map((message) => message.body)).toEqual([
      'the deck',
    ]);
    expect(result.files.map((file) => file.name)).toEqual(['deck.pdf']);
  });

  it('reads before: and after: as days in the caller’s time zone', async () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(await bodies(`pricing before:2000-01-01`)).toEqual([]);
    expect((await bodies(`pricing after:2000-01-01`)).length).toBe(6);
    expect(await bodies(`pricing after:2999-01-01 before:${today}`)).toEqual(
      []
    );
  });

  it('finds channels the caller can read and active members', async () => {
    const result = await search(run);
    expect(result.channels.map((channel) => channel.name).sort()).toEqual([
      `design-${run}`,
      `launch-${run}`,
      `mine-${run}`,
    ]);
    expect(
      result.channels.find((channel) => channel.name === `launch-${run}`)
        ?.joined
    ).toBe(false);
    expect((await search('bao tran')).people.map((p) => p.id)).toEqual([bao]);
  });

  it('drops a room the caller just left', async () => {
    await prisma.roomMember.deleteMany({
      where: { roomId: room('mine'), userId: ana },
    });
    expect(await bodies('pricing')).not.toContain('pricing in mine');
  });

  it('still finds channels and people when the index is down', async () => {
    state.fail = true;
    const result = await search(`design-${run}`);
    state.fail = false;

    expect(result.indexed).toBe(false);
    expect(result.messages).toEqual([]);
    expect(result.channels).toHaveLength(1);
  });
});
