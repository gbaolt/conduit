import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';
import { PrismaMessagesRepository } from '@/messages/infrastructure/prisma-messages.repository';

import { PrismaChannelsRepository } from './prisma-channels.repository';
import { PrismaDmsRepository } from './prisma-dms.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaDmsRepository', () => {
  const dms = new PrismaDmsRepository(prisma);
  const channels = new PrismaChannelsRepository(prisma);
  const messages = new PrismaMessagesRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const ids = Array.from({ length: 12 }, (_, i) => `${run}-u${i}`);
  const [linh, bao, cy] = ids as [string, string, string];
  const scope = (userId: string) => ({ userId, organizationId });
  const mentions = { userIds: [], channel: false, here: false };

  beforeAll(async () => {
    await prisma.user.createMany({
      data: ids.map((id) => ({ id, name: id, email: `${id}@test.local` })),
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'Acme',
        slug: `acme-${run}`,
        createdAt: new Date(),
      },
    });
    await prisma.member.createMany({
      data: ids.map((userId) => ({
        userId,
        organizationId,
        role: 'member',
        createdAt: new Date(),
      })),
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('opens one DM for the same people, in any order, even at once', async () => {
    const opened = await Promise.all([
      dms.open(scope(linh), [linh, bao]),
      dms.open(scope(bao), [bao, linh]),
      dms.open(scope(linh), [bao, linh]),
    ]);

    expect(new Set(opened.map((dm) => dm.id)).size).toBe(1);
    expect(opened[0]?.members.map((m) => m.userId).sort()).toEqual(
      [linh, bao].sort()
    );
    expect(
      await prisma.room.count({
        where: {
          organizationId,
          kind: 'DM',
          members: { some: { userId: bao } },
        },
      })
    ).toBe(1);
  });

  it('opens the self DM once', async () => {
    const first = await dms.open(scope(cy), [cy]);
    const again = await dms.open(scope(cy), [cy]);

    expect(again.id).toBe(first.id);
    expect(first.members).toHaveLength(1);
  });

  it('keeps a DM private and out of the channel list and browse', async () => {
    const dm = await dms.open(scope(linh), [linh, bao]);
    const stored = await prisma.room.findUniqueOrThrow({
      where: { id: dm.id },
    });

    expect(stored).toMatchObject({ kind: 'DM', visibility: 'PRIVATE' });
    for (const archived of [false, true]) {
      for (const user of [linh, bao, cy]) {
        const listed = await channels.list(scope(user), archived);
        expect(listed.map((channel) => channel.id)).not.toContain(dm.id);
      }
    }
  });

  it('lists only the viewer’s DMs, newest message first', async () => {
    const older = await dms.open(scope(bao), [bao, cy]);
    const newer = await dms.open(scope(bao), [bao]);
    await prisma.room.update({
      where: { id: older.id },
      data: { lastMessageAt: new Date('2026-01-01') },
    });
    await prisma.room.update({
      where: { id: newer.id },
      data: { lastMessageAt: new Date('2026-02-01') },
    });

    const listed = await dms.list(scope(bao));

    const order = listed.map((dm) => dm.id);
    expect(order.indexOf(newer.id)).toBeLessThan(order.indexOf(older.id));
    expect((await dms.list(scope(ids[5]!))).map((dm) => dm.id)).not.toContain(
      older.id
    );
  });

  it('adds people, rekeys the DM, and then opens to the same DM', async () => {
    const pair = await dms.open(scope(linh), [linh, bao]);

    const group = await dms.addPeople(scope(linh), pair.id, [cy]);

    expect(group.id).toBe(pair.id);
    expect(group.members).toHaveLength(3);
    const reopened = await dms.open(scope(cy), [linh, bao, cy]);
    expect(reopened.id).toBe(pair.id);
    const again = await dms.open(scope(linh), [linh, bao]);
    expect(again.id).not.toBe(pair.id);
  });

  it('refuses an eleventh person with DM_FULL and changes nothing', async () => {
    const nine = await dms.open(scope(ids[0]!), ids.slice(0, 10));

    await expect(
      dms.addPeople(scope(ids[0]!), nine.id, [ids[10]!])
    ).rejects.toMatchObject({ code: 'DM_FULL' });

    const stored = await prisma.roomMember.count({
      where: { roomId: nine.id },
    });
    expect(stored).toBe(10);
  });

  it('refuses to rekey onto a set that already has a DM', async () => {
    const trio = await dms.open(scope(ids[6]!), [ids[6]!, ids[7]!, ids[8]!]);
    const pair = await dms.open(scope(ids[6]!), [ids[6]!, ids[7]!]);

    await expect(
      dms.addPeople(scope(ids[6]!), pair.id, [ids[8]!])
    ).rejects.toMatchObject({ code: 'DM_EXISTS' });
    expect(trio.id).not.toBe(pair.id);
  });

  it('turns a DM into a private channel and keeps every message and member', async () => {
    const dm = await dms.open(scope(ids[9]!), [ids[9]!, ids[10]!, ids[11]!]);
    const first = await messages.send({
      roomId: dm.id,
      authorId: ids[10]!,
      clientId: 'one',
      body: 'hello',
      mentions,
    });
    await messages.send({
      roomId: dm.id,
      authorId: ids[9]!,
      clientId: 'two',
      body: 'reply',
      mentions,
      parentId: first.message.id,
    });

    const channel = await dms.convertToChannel(
      scope(ids[9]!),
      dm.id,
      `planning-${run.slice(0, 8)}`
    );

    expect(channel).toMatchObject({
      id: dm.id,
      kind: 'channel',
      visibility: 'private',
    });
    expect(channel.membership?.role).toBe('manager');
    const stored = await prisma.room.findUniqueOrThrow({
      where: { id: dm.id },
    });
    expect(stored.dmKey).toBeNull();
    expect(await prisma.message.count({ where: { roomId: dm.id } })).toBe(2);
    expect(
      (await prisma.roomMember.findMany({ where: { roomId: dm.id } }))
        .map((member) => member.userId)
        .sort()
    ).toEqual([ids[9], ids[10], ids[11]].sort());
    expect(
      (await channels.list(scope(ids[10]!), false)).map((c) => c.id)
    ).toContain(dm.id);
    expect((await dms.list(scope(ids[10]!))).map((d) => d.id)).not.toContain(
      dm.id
    );
    // The old set can open a fresh DM now that the key is free.
    const fresh = await dms.open(scope(ids[9]!), [ids[9]!, ids[10]!, ids[11]!]);
    expect(fresh.id).not.toBe(dm.id);
  });

  it('refuses a taken name and leaves the DM a DM', async () => {
    await prisma.room.create({
      data: { organizationId, name: 'taken-name' },
    });
    const dm = await dms.open(scope(linh), [linh, ids[4]!]);

    await expect(
      dms.convertToChannel(scope(linh), dm.id, 'taken-name')
    ).rejects.toMatchObject({ code: 'NAME_TAKEN' });

    const stored = await prisma.room.findUniqueOrThrow({
      where: { id: dm.id },
    });
    expect(stored.kind).toBe('DM');
  });

  it('converts once when two members convert at the same time', async () => {
    const dm = await dms.open(scope(linh), [linh, ids[3]!]);

    const results = await Promise.allSettled([
      dms.convertToChannel(scope(linh), dm.id, `once-a-${run.slice(0, 8)}`),
      dms.convertToChannel(scope(ids[3]!), dm.id, `once-b-${run.slice(0, 8)}`),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
