import {
  FILE_SIZE_MAX,
  FILE_TEXT_PREVIEW_MAX,
  type Room,
  WORKSPACE_STORAGE_MAX,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type {
  FileListQuery,
  FilesRepository,
  StoredFile,
} from '@/files/domain/files.repository';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';
import { createFakeStorage } from '@/storage/testing/fake-object-storage';

import { FilesService, type FileViewer } from './files.service';

const organizationId = 'org';
const viewerOf = (userId: string): FileViewer => ({
  userId,
  organizationId,
  workspaceRole: 'member',
});
const author = viewerOf('author');
const other = viewerOf('other');

function roomFor(member: boolean, overrides: Partial<Room> = {}): Room {
  return {
    id: 'c1',
    organizationId,
    kind: 'channel',
    name: 'design',
    topic: null,
    description: null,
    visibility: 'public',
    permissions: {
      post: 'everyone',
      reply: 'everyone',
      mentionEveryone: 'everyone',
    },
    isDefault: false,
    archivedAt: null,
    memberCount: 2,
    createdById: null,
    createdAt: new Date(0),
    membership: member
      ? {
          role: 'member',
          starredAt: null,
          sectionId: null,
          notify: null,
          mutedAt: null,
          closedAt: null,
        }
      : null,
    archivedByName: null,
    ...overrides,
  };
}

function setup(
  room: Room | null = roomFor(true),
  readable = ['c1'],
  /** Other rooms `rooms.find` knows, by id. Any other id finds `room`. */
  others: Room[] = []
) {
  const rows = new Map<string, StoredFile>();
  const listed: FileListQuery[] = [];
  const files = {
    createPending: async (file, cap) => {
      const used = [...rows.values()]
        .filter((row) => !row.deletedAt)
        .reduce((sum, row) => sum + row.size, 0);
      if (used + file.size > cap) return { created: false, used };
      rows.set(file.id, {
        ...file,
        messageId: null,
        width: null,
        height: null,
        status: 'pending',
        createdAt: new Date(),
        deletedAt: null,
        sourceFileId: file.sourceFileId ?? null,
      });
      return { created: true };
    },
    find: async (id) => rows.get(id) ?? null,
    findMany: async (ids) => ids.flatMap((id) => rows.get(id) ?? []),
    markReady: async (id, dimensions) => {
      const next = {
        ...rows.get(id)!,
        ...dimensions,
        status: 'ready' as const,
      };
      rows.set(id, next);
      return next;
    },
    sweepable: async (pendingBefore) =>
      [...rows.values()].filter(
        (row) =>
          row.deletedAt !== null ||
          (row.status === 'pending' && row.createdAt < pendingBefore)
      ),
    purge: async (ids) => {
      for (const id of ids) rows.delete(id);
    },
    list: async (query) => {
      listed.push(query);
      return { files: [], hasMore: false };
    },
    counts: async () => ({ image: 0, video: 0, pdf: 0, text: 0, other: 0 }),
    cancel: async (id) => {
      const row = rows.get(id)!;
      if (!row.messageId) rows.set(id, { ...row, deletedAt: new Date() });
    },
  } as FilesRepository;
  const rooms = {
    find: async (_viewer: unknown, id: string) =>
      others.find((other) => other.id === id) ?? room,
    accessibleRoomIds: async () => readable,
  } as Partial<RoomsRepository> as RoomsRepository;
  const { storage, objects, bytes, ranges } = createFakeStorage();
  return {
    service: new FilesService(files, rooms, storage),
    rows,
    objects,
    bytes,
    ranges,
    listed,
  };
}

const stored = (overrides: Partial<StoredFile>): StoredFile => ({
  id: 'f1',
  organizationId,
  uploaderId: 'author',
  roomId: 'c1',
  messageId: 'm1',
  name: 'q3.pdf',
  contentType: 'application/pdf',
  size: 10,
  width: null,
  height: null,
  key: 'files/org/f1/q3.pdf',
  status: 'ready',
  createdAt: new Date(0),
  deletedAt: null,
  sourceFileId: null,
  ...overrides,
});

const upload = {
  roomId: 'c1',
  name: 'Q3 pricing.pdf',
  contentType: 'application/pdf',
  size: 1000,
};

describe('FilesService', () => {
  it('hands out an upload URL under the private files prefix and stores a pending row', async () => {
    const { service, rows } = setup();

    const { fileId, uploadUrl } = await service.uploadUrl(author, upload);

    expect(uploadUrl).toBe(
      `https://upload.test/files/org/${fileId}/Q3-pricing.pdf`
    );
    expect(rows.get(fileId)).toMatchObject({
      status: 'pending',
      uploaderId: 'author',
      roomId: 'c1',
    });
  });

  it('refuses a file over 50 MB and names its size', async () => {
    const { service } = setup();

    await expect(
      service.uploadUrl(author, { ...upload, size: 72 * 1024 * 1024 })
    ).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
      message: 'Files can be up to 50 MB. This one is 72 MB.',
    });
  });

  it('counts pending uploads toward the cap', async () => {
    const { service } = setup();
    const half = Math.floor(WORKSPACE_STORAGE_MAX / FILE_SIZE_MAX);
    for (let i = 0; i < half; i += 1) {
      await service.uploadUrl(author, { ...upload, size: FILE_SIZE_MAX });
    }

    await expect(
      service.uploadUrl(author, { ...upload, size: FILE_SIZE_MAX })
    ).rejects.toMatchObject({
      code: 'STORAGE_FULL',
      message:
        'This workspace has used 10 GB of 10 GB. Delete files or ask an admin to free space.',
    });
  });

  it('hides a private channel the viewer is not in', async () => {
    const { service } = setup(roomFor(false, { visibility: 'private' }));

    await expect(service.uploadUrl(author, upload)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses a room the viewer can read but not post in', async () => {
    const archived = setup(roomFor(true, { archivedAt: new Date() }));
    const notJoined = setup(roomFor(false));

    await expect(
      archived.service.uploadUrl(author, upload)
    ).rejects.toMatchObject({
      code: 'CHANNEL_ARCHIVED',
    });
    await expect(
      notJoined.service.uploadUrl(author, upload)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('completes only once storage holds the promised size, and again changes nothing', async () => {
    const { service, rows, objects } = setup();
    const { fileId } = await service.uploadUrl(author, upload);
    const { key } = rows.get(fileId)!;

    await expect(service.complete(author, { fileId })).rejects.toMatchObject({
      code: 'UPLOAD_MISSING',
    });
    objects.set(key, 999);
    await expect(service.complete(author, { fileId })).rejects.toMatchObject({
      code: 'UPLOAD_MISSING',
    });
    objects.set(key, 1000);

    expect(await service.complete(author, { fileId })).toMatchObject({
      id: fileId,
      size: 1000,
    });
    expect(await service.complete(author, { fileId })).toMatchObject({
      id: fileId,
    });
    expect(rows.get(fileId)!.status).toBe('ready');
  });

  it('keeps measured dimensions for an image, not for a PDF', async () => {
    const { service, rows, objects } = setup();
    const image = await service.uploadUrl(author, {
      ...upload,
      name: 'a.png',
      contentType: 'image/png',
    });
    const pdf = await service.uploadUrl(author, upload);
    objects.set(rows.get(image.fileId)!.key, 1000);
    objects.set(rows.get(pdf.fileId)!.key, 1000);

    expect(
      await service.complete(author, {
        fileId: image.fileId,
        width: 640,
        height: 480,
      })
    ).toMatchObject({
      width: 640,
      height: 480,
    });
    expect(
      await service.complete(author, {
        fileId: pdf.fileId,
        width: 640,
        height: 480,
      })
    ).toMatchObject({
      width: null,
      height: null,
    });
  });

  it('lets only the uploader complete or cancel a file', async () => {
    const { service } = setup();
    const { fileId } = await service.uploadUrl(author, upload);

    await expect(service.complete(other, { fileId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.cancel(other, fileId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('frees the cap when an upload is cancelled', async () => {
    const { service, rows } = setup();
    const { fileId } = await service.uploadUrl(author, {
      ...upload,
      size: FILE_SIZE_MAX,
    });

    await service.cancel(author, fileId);

    expect(rows.get(fileId)!.deletedAt).not.toBeNull();
    await expect(service.cancel(author, fileId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  describe('urls', () => {
    it('signs a view and a download link for a file in a room the viewer can read', async () => {
      const { service, rows } = setup();
      rows.set('f1', stored({}));

      expect(await service.urls(other, ['f1'])).toEqual([
        {
          id: 'f1',
          viewUrl: 'https://download.test/files/org/f1/q3.pdf?inline',
          downloadUrl: 'https://download.test/files/org/f1/q3.pdf?attachment',
        },
      ]);
    });

    it('gives a file the browser should not open in place no view link', async () => {
      const { service, rows } = setup();
      rows.set('f1', stored({ contentType: 'text/html', name: 'a.html' }));

      expect((await service.urls(other, ['f1']))[0]!.viewUrl).toBeNull();
    });

    it('leaves out a file in a room the viewer cannot read, a deleted one, an unsent one, and one from another workspace', async () => {
      const { service, rows } = setup(roomFor(true), ['c1']);
      rows.set('private', stored({ id: 'private', roomId: 'secret' }));
      rows.set('deleted', stored({ id: 'deleted', deletedAt: new Date() }));
      rows.set('unsent', stored({ id: 'unsent', messageId: null }));
      rows.set('elsewhere', stored({ id: 'elsewhere', organizationId: 'x' }));

      expect(
        await service.urls(other, [
          'private',
          'deleted',
          'unsent',
          'elsewhere',
          'missing',
        ])
      ).toEqual([]);
    });
  });

  describe('text', () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    const textFile = (overrides: Partial<StoredFile> = {}) =>
      stored({
        name: 'notes.ts',
        contentType: 'text/plain',
        key: 'files/org/f1/notes.ts',
        size: 12,
        ...overrides,
      });

    it('reads a text file in a room the viewer can read', async () => {
      const { service, rows, bytes } = setup();
      rows.set('f1', textFile());
      bytes.set('files/org/f1/notes.ts', encode('const a = 1;'));

      expect(await service.text(other, 'f1')).toEqual({
        text: 'const a = 1;',
        truncated: false,
      });
    });

    it('hides a file in a room the viewer cannot read', async () => {
      const { service, rows } = setup(roomFor(true), []);
      rows.set('f1', textFile());

      await expect(service.text(other, 'f1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('reads only the first 64 KB of a large file, and says it was cut', async () => {
      const { service, rows, bytes, ranges } = setup();
      const size = 100 * 1024;
      rows.set('f1', textFile({ size }));
      bytes.set('files/org/f1/notes.ts', encode('a'.repeat(size)));

      const result = await service.text(other, 'f1');

      expect(ranges).toEqual([
        ['files/org/f1/notes.ts', FILE_TEXT_PREVIEW_MAX],
      ]);
      expect(result.text).toHaveLength(FILE_TEXT_PREVIEW_MAX);
      expect(result.truncated).toBe(true);
    });

    it('drops a character the 64 KB cut splits', async () => {
      const { service, rows, bytes } = setup();
      const text = 'a'.repeat(FILE_TEXT_PREVIEW_MAX - 1) + 'é';
      rows.set('f1', textFile({ size: encode(text).length }));
      bytes.set('files/org/f1/notes.ts', encode(text));

      const result = await service.text(other, 'f1');

      expect(result.text).toBe('a'.repeat(FILE_TEXT_PREVIEW_MAX - 1));
      expect(result.text).not.toContain('�');
    });

    it('refuses a file that is not text, by its type or by its bytes', async () => {
      const { service, rows, bytes } = setup();
      rows.set('pdf', stored({ id: 'pdf' }));
      rows.set('f1', textFile());
      bytes.set('files/org/f1/notes.ts', new Uint8Array([104, 0, 105]));

      await expect(service.text(other, 'pdf')).rejects.toMatchObject({
        code: 'NOT_TEXT',
      });
      await expect(service.text(other, 'f1')).rejects.toMatchObject({
        code: 'NOT_TEXT',
      });
    });
  });

  describe('attach', () => {
    const design = roomFor(true, { id: 'design', name: 'design' });
    const leads = roomFor(true, {
      id: 'leads',
      name: 'leads',
      visibility: 'private',
    });
    const dm = roomFor(true, { id: 'dm1', kind: 'dm', visibility: 'private' });
    const sent = (roomId: string, overrides: Partial<StoredFile> = {}) =>
      stored({ roomId, key: `files/org/f1/q3.pdf`, ...overrides });
    const setupWith = (target: Room = roomFor(true)) => {
      const context = setup(
        target,
        ['c1', 'design', 'leads', 'dm1'],
        [design, leads, dm]
      );
      context.objects.set('files/org/f1/q3.pdf', 10);
      return context;
    };
    const copies = (rows: Map<string, StoredFile>) =>
      [...rows.values()].filter((row) => row.id !== 'f1');

    it("copies a public channel's file into the room, as the viewer's own, linked to the original", async () => {
      const { service, rows, objects } = setupWith();
      rows.set('f1', sent('design'));

      const file = await service.attach(other, { fileId: 'f1', roomId: 'c1' });

      expect(file).toMatchObject({ name: 'q3.pdf', size: 10 });
      const [copy] = copies(rows);
      expect(copy).toMatchObject({
        id: file.id,
        roomId: 'c1',
        uploaderId: 'other',
        status: 'ready',
        messageId: null,
        sourceFileId: 'f1',
      });
      expect(copy!.key).not.toBe('files/org/f1/q3.pdf');
      expect(objects.get(copy!.key)).toBe(10);
    });

    it('links a copy of a copy to the original', async () => {
      const { service, rows } = setupWith();
      rows.set('f1', sent('design', { sourceFileId: 'original' }));

      await service.attach(other, { fileId: 'f1', roomId: 'c1' });

      expect(copies(rows)[0]!.sourceFileId).toBe('original');
    });

    it("refuses a private channel's file and a DM's file, even for a member, and stores nothing", async () => {
      const { service, rows, objects } = setupWith();
      rows.set('f1', sent('leads'));
      rows.set('f2', sent('dm1', { id: 'f2' }));

      for (const fileId of ['f1', 'f2']) {
        await expect(
          service.attach(other, { fileId, roomId: 'c1' })
        ).rejects.toMatchObject({ code: 'FILE_NOT_SHAREABLE' });
      }
      expect(rows.size).toBe(2);
      expect(objects.size).toBe(1);
    });

    it("copies a private channel's file back into that channel", async () => {
      const { service, rows } = setupWith(leads);
      rows.set('f1', sent('leads'));

      await service.attach(other, { fileId: 'f1', roomId: 'leads' });

      expect(copies(rows)[0]!.roomId).toBe('leads');
    });

    it('hides a file the viewer cannot read, and refuses an archived room or a full workspace', async () => {
      const unreadable = setupWith();
      unreadable.rows.set('f1', sent('secret'));
      await expect(
        unreadable.service.attach(other, { fileId: 'f1', roomId: 'c1' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      const archived = setupWith(roomFor(true, { archivedAt: new Date() }));
      archived.rows.set('f1', sent('design'));
      await expect(
        archived.service.attach(other, { fileId: 'f1', roomId: 'c1' })
      ).rejects.toMatchObject({ code: 'CHANNEL_ARCHIVED' });

      const full = setupWith();
      full.rows.set('f1', sent('design', { size: WORKSPACE_STORAGE_MAX }));
      await expect(
        full.service.attach(other, { fileId: 'f1', roomId: 'c1' })
      ).rejects.toMatchObject({ code: 'STORAGE_FULL' });
    });
  });

  describe('list', () => {
    it('narrows to the viewer, to everyone else, to kinds, and to channels', async () => {
      const { service, listed } = setup();

      await service.list(other, { owner: 'me' });
      await service.list(other, { owner: 'others' });
      await service.list(other, {
        kinds: ['pdf', 'text'],
        roomKind: 'channel',
      });

      expect(listed[0]).toMatchObject({ uploaderId: 'other' });
      expect(listed[1]).toMatchObject({ notUploaderId: 'other' });
      expect(listed[2]).toMatchObject({
        kinds: ['pdf', 'text'],
        roomKind: 'channel',
      });
    });

    it("lists nothing for the viewer's own files from someone else", async () => {
      const { service, listed } = setup();

      expect(
        await service.list(other, { owner: 'me', uploaderId: 'author' })
      ).toEqual({ files: [], hasMore: false });
      expect(listed).toEqual([]);
    });

    it('lists only the rooms the viewer can read, and narrows to one of them', async () => {
      const { service, listed } = setup(roomFor(true), ['c1', 'c2']);

      await service.list(other, {});
      await service.list(other, { roomId: 'c2', name: '' });

      expect(listed.map((query) => query.roomIds)).toEqual([
        ['c1', 'c2'],
        ['c2'],
      ]);
      expect(listed[1]!.name).toBeUndefined();
    });

    it('lists nothing for a room the viewer cannot read, without asking the repository', async () => {
      const { service, listed } = setup(roomFor(true), ['c1']);

      expect(await service.list(other, { roomId: 'secret' })).toEqual({
        files: [],
        hasMore: false,
      });
      expect(listed).toEqual([]);
    });
  });

  it('sweeps an upload abandoned for a day and a cancelled one, with their objects, and keeps the rest', async () => {
    const { service, rows, objects } = setup();
    const kept = await service.uploadUrl(author, upload);
    const abandoned = await service.uploadUrl(author, upload);
    const cancelled = await service.uploadUrl(author, upload);
    for (const { fileId } of [kept, abandoned, cancelled]) {
      objects.set(rows.get(fileId)!.key, 1000);
    }
    rows.set(abandoned.fileId, {
      ...rows.get(abandoned.fileId)!,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    await service.cancel(author, cancelled.fileId);

    expect(await service.sweep(new Date())).toBe(2);
    expect([...rows.keys()]).toEqual([kept.fileId]);
    expect(objects.size).toBe(1);
  });
});
