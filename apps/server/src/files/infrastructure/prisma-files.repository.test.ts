import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaFilesRepository } from './prisma-files.repository';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaFilesRepository', () => {
  const repository = new PrismaFilesRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const userId = `${run}-user`;
  const roomId = `${run}-room`;
  const newFile = (size: number) => {
    const id = crypto.randomUUID();
    return {
      id,
      organizationId,
      uploaderId: userId,
      roomId,
      name: 'a.pdf',
      contentType: 'application/pdf',
      size,
      key: `files/${organizationId}/${id}/a.pdf`,
    };
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

  it('lets only one of two uploads racing for the last bytes of the cap through', async () => {
    const results = await Promise.all([
      repository.createPending(newFile(60), 100),
      repository.createPending(newFile(60), 100),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.find((result) => !result.created)).toEqual({
      created: false,
      used: 60,
    });
  });

  it('frees the bytes of a cancelled file', async () => {
    const pending = await prisma.file.findFirstOrThrow({
      where: { organizationId },
    });
    await repository.cancel(pending.id);

    expect(await repository.createPending(newFile(100), 100)).toEqual({
      created: true,
    });
    expect((await repository.find(pending.id))!.deletedAt).not.toBeNull();
  });

  it('marks a file ready once, keeping its first dimensions', async () => {
    const file = newFile(1);
    await prisma.file.create({ data: file });

    expect(
      await repository.markReady(file.id, { width: 10, height: 20 })
    ).toMatchObject({
      status: 'ready',
      width: 10,
      height: 20,
    });
    expect(
      await repository.markReady(file.id, { width: 1, height: 1 })
    ).toMatchObject({ width: 10 });
  });
  describe('list', () => {
    const otherRoomId = `${run}-other`;
    const at = new Date('2026-11-01T10:00:00Z');
    const sent = async (
      name: string,
      overrides: Partial<{
        roomId: string;
        contentType: string;
        createdAt: Date;
      }> = {}
    ) => {
      const room = overrides.roomId ?? roomId;
      const message = await prisma.message.create({
        data: {
          roomId: room,
          authorId: userId,
          clientId: crypto.randomUUID(),
          body: '',
        },
      });
      const file = { ...newFile(1), name, roomId: room };
      await prisma.file.create({
        data: {
          ...file,
          contentType: overrides.contentType ?? 'application/pdf',
          createdAt: overrides.createdAt ?? at,
          status: 'READY',
          messageId: message.id,
        },
      });
      return file.id;
    };
    const query = { organizationId, roomIds: [roomId], limit: 10 };

    beforeAll(async () => {
      await prisma.room.create({
        data: { id: otherRoomId, organizationId, name: 'secret' },
      });
    });

    it('lists sent files in the given rooms only, newest first, with where and by whom', async () => {
      const older = await sent('Q2 notes.pdf', {
        createdAt: new Date('2026-10-01'),
      });
      const newer = await sent('Q3 pricing.pdf');
      await sent('elsewhere.pdf', { roomId: otherRoomId });

      const { files, hasMore } = await repository.list(query);

      expect(files.map((file) => file.id)).toEqual([newer, older]);
      expect(files[0]).toMatchObject({
        name: 'Q3 pricing.pdf',
        room: { id: roomId, name: 'design', kind: 'channel' },
        uploader: { id: userId, name: 'Linh' },
        parentId: null,
      });
      expect(hasMore).toBe(false);
    });

    it('narrows by kind and by part of the name, ignoring case', async () => {
      const image = await sent('Mockup.PNG', { contentType: 'image/png' });
      const zip = await sent('assets.zip', { contentType: 'application/zip' });
      const code = await sent('snippet.ts', { contentType: 'text/plain' });
      const data = await sent('rows.json', {
        contentType: 'application/json',
      });

      expect(
        (await repository.list({ ...query, kinds: ['image'] })).files.map(
          (f) => f.id
        )
      ).toEqual([image]);
      expect(
        (await repository.list({ ...query, kinds: ['other'] })).files.map(
          (f) => f.id
        )
      ).toEqual([zip]);
      expect(
        (await repository.list({ ...query, kinds: ['text'] })).files
          .map((f) => f.id)
          .sort()
      ).toEqual([data, code].sort());
      expect(
        (await repository.list({ ...query, name: 'mockup' })).files.map(
          (f) => f.id
        )
      ).toEqual([image]);
    });

    it('counts each kind, and narrows to an uploader, to everyone else, and to channels', async () => {
      const dmId = `${run}-dm`;
      await prisma.room.create({
        data: { id: dmId, organizationId, name: `${run}-key`, kind: 'DM' },
      });
      const scoped = { organizationId, roomIds: [dmId], limit: 10 };
      const note = await sent('note.txt', {
        roomId: dmId,
        contentType: 'text/plain',
      });
      await sent('shot.png', { roomId: dmId, contentType: 'image/png' });
      const none = { image: 0, video: 0, pdf: 0, text: 0, other: 0 };

      expect(await repository.counts(scoped)).toEqual({
        ...none,
        image: 1,
        text: 1,
      });
      expect(
        await repository.counts({ ...scoped, roomKind: 'channel' })
      ).toEqual(none);
      expect(
        (await repository.list({ ...scoped, kinds: ['text'] })).files
      ).toMatchObject([
        { id: note, room: { kind: 'dm', name: '', visibility: 'private' } },
      ]);
      expect(
        (await repository.list({ ...scoped, notUploaderId: userId })).files
      ).toEqual([]);
      expect(
        (await repository.list({ ...scoped, uploaderId: userId })).files
      ).toHaveLength(2);
    });

    it('pages through files that share a time without skipping or repeating one', async () => {
      const all = (await repository.list({ ...query, limit: 100 })).files.map(
        (f) => f.id
      );
      const seen: string[] = [];
      let before: string | undefined;
      for (;;) {
        const page = await repository.list({ ...query, limit: 2, before });
        seen.push(...page.files.map((f) => f.id));
        if (!page.hasMore) break;
        before = page.files.at(-1)!.id;
      }

      expect(seen).toEqual(all);
      expect(all.length).toBeGreaterThan(2);
    });

    it('leaves out a deleted file and lists nothing after an unknown cursor', async () => {
      const gone = await sent('gone.pdf');
      await prisma.file.update({
        where: { id: gone },
        data: { deletedAt: new Date() },
      });

      expect(
        (await repository.list(query)).files.map((f) => f.id)
      ).not.toContain(gone);
      expect(await repository.list({ ...query, before: 'missing' })).toEqual({
        files: [],
        hasMore: false,
      });
    });
  });
});
