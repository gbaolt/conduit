import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';
import { PrismaMessagesRepository } from '@/messages/infrastructure/prisma-messages.repository';
import type { FileText } from '@/search/domain/file-text.port';
import { markForSearch } from '@/search/infrastructure/mark-for-search';
import { PrismaSearchSyncRepository } from '@/search/infrastructure/prisma-search-sync.repository';
import { createFakeSearchIndex } from '@/search/testing/fake-search-index';

import {
  LEASE_MS,
  RETRY,
  retryDelay,
  SearchSyncService,
} from './search-sync.service';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('SearchSyncService', () => {
  const run = crypto.randomUUID();
  const organizationId = run;
  const userId = `${run}-user`;
  const roomId = `${run}-room`;
  const messages = new PrismaMessagesRepository(prisma);
  const rows = new PrismaSearchSyncRepository(prisma);
  const { index, docs, state } = createFakeSearchIndex();
  const texts = new Map<string, string>();
  const fileText: FileText = {
    extract: async ({ key }) => texts.get(key) ?? '',
  };
  const service = new SearchSyncService(rows, index, fileText);
  const mentions = { userIds: [], channel: false, here: false };
  const ids = () => [...docs(organizationId).keys()].sort();
  const syncRows = () =>
    prisma.searchSync.findMany({ where: { organizationId } });

  const send = (clientId: string, body: string, fileIds: string[] = []) =>
    messages.send({
      roomId,
      authorId: userId,
      clientId,
      body,
      mentions,
      fileIds,
      items: () => [],
    });

  const readyFile = async (name: string) => {
    const id = crypto.randomUUID();
    const key = `files/${organizationId}/${id}/${name}`;
    await prisma.file.create({
      data: {
        id,
        organizationId,
        uploaderId: userId,
        roomId,
        name,
        contentType: 'application/pdf',
        size: 10,
        key,
        status: 'READY',
      },
    });
    return { id, key };
  };

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, name: 'Linh', email: `${userId}@test.local` },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'Acme',
        slug: `acme-${run}`,
        createdAt: new Date(),
      },
    });
    await prisma.room.create({
      data: { id: roomId, organizationId, name: 'design' },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('indexes a sent message, and a second drain changes nothing', async () => {
    const { message } = await send('first', 'Pricing is final');

    expect(await syncRows()).toHaveLength(1);
    expect(await service.drain({ organizationId })).toEqual({
      claimed: 1,
      synced: 1,
    });
    expect(docs(organizationId).get(`message:${message.id}`)!.data).toBe(
      'Pricing is final'
    );
    expect(await syncRows()).toEqual([]);
    expect(await service.drain({ organizationId })).toEqual({
      claimed: 0,
      synced: 0,
    });
  });

  it('writes one row for a retried send', async () => {
    await send('retried', 'Once');
    await send('retried', 'Once');

    expect(await syncRows()).toHaveLength(1);
    await service.drain({ organizationId });
  });

  it('follows an edit, then removes the document when the message is deleted', async () => {
    const { message } = await send('edited', 'Draft');
    await service.drain({ organizationId });
    await messages.edit(message.id, 'Final', mentions, []);
    await service.drain({ organizationId });

    expect(docs(organizationId).get(`message:${message.id}`)!.data).toBe(
      'Final'
    );

    await messages.markDeleted(message.id);
    await service.drain({ organizationId });

    expect(ids()).not.toContain(`message:${message.id}`);
  });

  it('never indexes a message deleted before its first drain', async () => {
    const { message } = await send('gone', 'Oops');
    await messages.markDeleted(message.id);
    await service.drain({ organizationId });

    expect(ids()).not.toContain(`message:${message.id}`);
    expect(await syncRows()).toEqual([]);
  });

  it('lets two drains at once take each row once', async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, n) => send(`burst-${n}`, `Burst ${n}`))
    );

    const results = await Promise.all([
      service.drain({ organizationId, limit: 4 }),
      service.drain({ organizationId, limit: 4 }),
    ]);

    expect(results.reduce((sum, result) => sum + result.claimed, 0)).toBe(6);
    expect(await syncRows()).toEqual([]);
  });

  it('keeps a row that failed, with the error, and retries it after a backoff', async () => {
    state.fail = true;
    const { message } = await send('outage', 'During the outage');

    expect(await service.drain({ organizationId })).toEqual({
      claimed: 1,
      synced: 0,
    });
    const [row] = await syncRows();
    expect(row).toMatchObject({
      targetId: message.id,
      attempts: 1,
      lastError: 'The search index is down.',
    });
    const [{ wait }] = await prisma.$queryRaw<[{ wait: number }]>`
      SELECT EXTRACT(EPOCH FROM ("dueAt" - now())) * 1000 AS wait
      FROM "SearchSync" WHERE "targetId" = ${message.id}`;
    expect(Number(wait)).toBeGreaterThan(retryDelay(1) - 10_000);
    expect(Number(wait)).toBeLessThanOrEqual(retryDelay(1));

    state.fail = false;
    await prisma.searchSync.updateMany({
      where: { organizationId },
      data: { dueAt: new Date(0) },
    });
    await service.drain({ organizationId });

    expect(ids()).toContain(`message:${message.id}`);
    expect(await syncRows()).toEqual([]);
  });

  const leaseWait = async (targetId: string) => {
    const [{ wait }] = await prisma.$queryRaw<[{ wait: number }]>`
      SELECT EXTRACT(EPOCH FROM ("dueAt" - now())) * 1000 AS wait
      FROM "SearchSync" WHERE "targetId" = ${targetId}`;
    return Number(wait);
  };

  it('counts a drain that died mid-row as an attempt, and leases the row longer each time', async () => {
    const { message } = await send('crash', 'Before the crash');
    const crash = async () => {
      await prisma.searchSync.updateMany({
        where: { organizationId },
        data: { dueAt: new Date(0) },
      });
      await rows.claim({
        organizationId,
        limit: 10,
        leaseMs: LEASE_MS,
        retry: RETRY,
      });
    };

    await crash();
    await crash();
    expect((await syncRows())[0]).toMatchObject({ attempts: 2 });
    expect(await leaseWait(message.id)).toBeGreaterThan(LEASE_MS - 10_000);

    await crash();
    expect(await leaseWait(message.id)).toBeGreaterThan(retryDelay(3) - 10_000);

    await prisma.searchSync.updateMany({
      where: { organizationId },
      data: { dueAt: new Date(0) },
    });
    await service.drain({ organizationId });
    expect(ids()).toContain(`message:${message.id}`);
    expect(await syncRows()).toEqual([]);
  });

  it('hands back the rows it had no time for, due now and uncounted', async () => {
    await send('late-1', 'Late one');
    await send('late-2', 'Late two');

    expect(await service.drain({ organizationId, until: Date.now() })).toEqual({
      claimed: 2,
      synced: 0,
    });
    const left = await syncRows();
    expect(left).toHaveLength(2);
    expect(
      left.every((row) => row.attempts === 0 && row.dueAt <= new Date())
    ).toBe(true);

    expect(await service.drain({ organizationId })).toMatchObject({
      synced: 2,
    });
  });

  it('reindexes a file whose text shrinks, and drops it with its message', async () => {
    const pdf = await readyFile('report.pdf');
    texts.set(pdf.key, 'z'.repeat(2000 * 4));
    const { message } = await send('with-file', '', [pdf.id]);
    await service.drain({ organizationId });

    const chunks = () => ids().filter((id) => id.startsWith(`file:${pdf.id}`));
    expect(chunks()).toHaveLength(5);
    expect(ids()).not.toContain(`message:${message.id}`);

    texts.set(pdf.key, 'z'.repeat(2000));
    await prisma.$transaction((tx) =>
      markForSearch(tx, roomId, [{ kind: 'file', targetId: pdf.id }])
    );
    await service.drain({ organizationId });

    expect(chunks()).toEqual([`file:${pdf.id}:0`, `file:${pdf.id}:1`]);

    await messages.markDeleted(message.id);
    await service.drain({ organizationId });

    expect(chunks()).toEqual([]);
    expect(
      (await prisma.file.findUniqueOrThrow({ where: { id: pdf.id } }))
        .indexedChunks
    ).toBe(0);
  });
});
