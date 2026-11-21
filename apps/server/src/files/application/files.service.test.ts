import {
  FILE_SIZE_MAX,
  type Room,
  WORKSPACE_STORAGE_MAX,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type {
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

function setup(room: Room | null = roomFor(true), readable = ['c1']) {
  const rows = new Map<string, StoredFile>();
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
    cancel: async (id) => {
      const row = rows.get(id)!;
      if (!row.messageId) rows.set(id, { ...row, deletedAt: new Date() });
    },
  } as FilesRepository;
  const rooms = {
    find: async () => room,
    accessibleRoomIds: async () => readable,
  } as Partial<RoomsRepository> as RoomsRepository;
  const { storage, objects } = createFakeStorage();
  return { service: new FilesService(files, rooms, storage), rows, objects };
}

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
      ...overrides,
    });

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
});
