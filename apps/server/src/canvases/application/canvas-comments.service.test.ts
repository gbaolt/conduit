import {
  type CanvasAction,
  type CanvasComment,
  type CanvasCommentThread,
  checkCanvas,
  type PolicyCanvas,
} from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type {
  CanvasCommentsRepository,
  StoredCanvasComment,
} from '@/canvases/domain/canvas-comments.repository';
import { canvasError } from '@/canvases/domain/canvas-errors';
import { PrismaCanvasCommentsRepository } from '@/canvases/infrastructure/prisma-canvas-comments.repository';
import { PrismaCanvasVersionsRepository } from '@/canvases/infrastructure/prisma-canvas-versions.repository';
import { PrismaCanvasesRepository } from '@/canvases/infrastructure/prisma-canvases.repository';
import { FakeLiveblocksGateway } from '@/canvases/testing/fake-liveblocks.gateway';
import { prisma } from '@/infrastructure/database/prisma.service';
import { PrismaRoomsRepository } from '@/rooms/infrastructure/prisma-rooms.repository';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { CanvasCommentsService } from './canvas-comments.service';
import { CanvasesService, type CanvasViewerScope } from './canvases.service';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const viewerOf = (userId: string): CanvasViewerScope => ({
  userId,
  organizationId: 'org',
  workspaceRole: 'member',
});
const alice = viewerOf('alice');
const bob = viewerOf('bob');
const carol = viewerOf('carol');

/** A standalone canvas: alice and bob edit it, carol only views it. */
const standalone: PolicyCanvas = {
  createdById: 'alice',
  channel: null,
  membership: null,
};
const roles: Record<string, 'editor' | 'viewer'> = {
  alice: 'editor',
  bob: 'editor',
  carol: 'viewer',
};

/** Checks access with the real canvas policy, as `CanvasesService.load` does. */
function canvasesFor(canvas: (viewer: CanvasViewerScope) => PolicyCanvas) {
  return {
    load: async (
      viewer: CanvasViewerScope,
      _id: string,
      action: CanvasAction
    ) => {
      await Promise.resolve();
      const denial = checkCanvas(action, viewer, canvas(viewer));
      if (denial) throw canvasError(denial);
    },
  } as unknown as CanvasesService;
}

function fakeComments() {
  const threads = new Map<string, Omit<CanvasCommentThread, 'comments'>>();
  const comments = new Map<
    string,
    { comment: CanvasComment; canvasId: string; deleted: boolean }
  >();
  let next = 0;
  const id = (prefix: string) => `${prefix}-${++next}`;
  const live = (threadId: string) =>
    [...comments.values()]
      .filter((row) => row.comment.threadId === threadId && !row.deleted)
      .map((row) => row.comment);
  const withComments = (threadId: string) => {
    const thread = threads.get(threadId);
    const list = live(threadId);
    return thread && list.length > 0 ? { ...thread, comments: list } : null;
  };
  const add = (
    canvasId: string,
    threadId: string,
    { authorId, body }: { authorId: string; body: string }
  ) => {
    const comment: CanvasComment = {
      id: id('comment'),
      threadId,
      author: { id: authorId, name: authorId, image: null },
      body,
      editedAt: null,
      createdAt: new Date(),
    };
    comments.set(comment.id, { comment, canvasId, deleted: false });
    return comment;
  };
  const repository = {
    list: async (canvasId) =>
      [...threads.values()]
        .filter((thread) => thread.canvasId === canvasId)
        .flatMap((thread) => withComments(thread.id) ?? []),
    findThread: async (canvasId, threadId) => {
      const thread = withComments(threadId);
      return thread?.canvasId === canvasId ? thread : null;
    },
    findComment: async (canvasId, commentId) => {
      const row = comments.get(commentId);
      if (!row || row.deleted || row.canvasId !== canvasId) return null;
      const stored: StoredCanvasComment = { ...row.comment, canvasId };
      return stored;
    },
    createThread: async (thread, comment) => {
      const threadId = id('thread');
      threads.set(threadId, {
        id: threadId,
        canvasId: thread.canvasId,
        quote: thread.quote,
        resolvedAt: null,
        createdAt: new Date(),
      });
      add(thread.canvasId, threadId, comment);
      return withComments(threadId)!;
    },
    reply: async (threadId, comment) =>
      add(threads.get(threadId)!.canvasId, threadId, comment),
    edit: async (commentId, body) => {
      const row = comments.get(commentId)!;
      row.comment = { ...row.comment, body, editedAt: new Date() };
      return row.comment;
    },
    softDelete: async (commentId) => {
      comments.get(commentId)!.deleted = true;
    },
    setResolved: async (threadId, resolvedById) => {
      threads.get(threadId)!.resolvedAt = resolvedById ? new Date() : null;
      return withComments(threadId)!;
    },
  } satisfies CanvasCommentsRepository;
  return repository;
}

function setup(
  canvas: (viewer: CanvasViewerScope) => PolicyCanvas = (viewer) => ({
    ...standalone,
    membership: roles[viewer.userId] ? { role: roles[viewer.userId]! } : null,
  })
) {
  return new CanvasCommentsService(canvasesFor(canvas), fakeComments());
}

const start = (service: CanvasCommentsService, body = 'Is this right?') =>
  service.createThread(alice, { canvasId: 'canvas', quote: 'Ship it', body });

describe('CanvasCommentsService', () => {
  it('starts a thread and lists it with its replies, oldest first', async () => {
    const service = setup();
    const thread = await start(service);
    await service.reply(bob, {
      canvasId: 'canvas',
      threadId: thread.id,
      body: 'Yes.',
    });

    const [listed] = await service.list(carol, 'canvas');
    expect(listed).toMatchObject({ quote: 'Ship it', resolvedAt: null });
    expect(listed?.comments.map((each) => [each.author.id, each.body])).toEqual(
      [
        ['alice', 'Is this right?'],
        ['bob', 'Yes.'],
      ]
    );
  });

  it('lets an author edit and delete only their own comment', async () => {
    const service = setup();
    const thread = await start(service);
    const [first] = thread.comments;
    const reply = await service.reply(bob, {
      canvasId: 'canvas',
      threadId: thread.id,
      body: 'Yes.',
    });

    await expect(
      service.edit(bob, { canvasId: 'canvas', commentId: first!.id, body: 'x' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.delete(bob, { canvasId: 'canvas', commentId: first!.id })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const edited = await service.edit(bob, {
      canvasId: 'canvas',
      commentId: reply.id,
      body: 'Yes, ship it.',
    });
    expect(edited.editedAt).not.toBeNull();
    await service.delete(bob, { canvasId: 'canvas', commentId: reply.id });
    expect(
      (await service.list(alice, 'canvas'))[0]?.comments.map((c) => c.id)
    ).toEqual([first!.id]);
  });

  it('drops a thread from the list once its last comment is deleted', async () => {
    const service = setup();
    const thread = await start(service);
    await service.delete(alice, {
      canvasId: 'canvas',
      commentId: thread.comments[0]!.id,
    });
    expect(await service.list(alice, 'canvas')).toEqual([]);
    await expect(
      service.reply(bob, { canvasId: 'canvas', threadId: thread.id, body: 'x' })
    ).rejects.toMatchObject({ code: 'COMMENT_NOT_FOUND' });
  });

  it('resolves and reopens a thread, keeping its quote', async () => {
    const service = setup();
    const thread = await start(service);
    const resolved = await service.resolve(bob, {
      canvasId: 'canvas',
      threadId: thread.id,
      resolved: true,
    });
    expect(resolved).toMatchObject({ quote: 'Ship it' });
    expect(resolved.resolvedAt).not.toBeNull();

    const reopened = await service.resolve(alice, {
      canvasId: 'canvas',
      threadId: thread.id,
      resolved: false,
    });
    expect(reopened.resolvedAt).toBeNull();
  });

  it('lets a viewer read comments but not write them', async () => {
    const service = setup();
    const thread = await start(service);

    expect(await service.list(carol, 'canvas')).toHaveLength(1);
    await expect(
      service.createThread(carol, { canvasId: 'canvas', quote: 'a', body: 'b' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.reply(carol, {
        canvasId: 'canvas',
        threadId: thread.id,
        body: 'b',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.resolve(carol, {
        canvasId: 'canvas',
        threadId: thread.id,
        resolved: true,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not read comments when canvas authorization denies access', async () => {
    const comments = fakeComments();
    const list = vi
      .spyOn(comments, 'list')
      .mockRejectedValue(new Error('Comments read failed'));
    const service = new CanvasCommentsService(
      canvasesFor(() => standalone),
      comments
    );

    await expect(
      service.list(viewerOf('dave'), 'canvas')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(list).not.toHaveBeenCalled();
  });

  it('keeps comments on an archived channel canvas readable but closed', async () => {
    const service = setup(() => ({
      createdById: 'alice',
      membership: null,
      channel: {
        kind: 'channel',
        visibility: 'public',
        isDefault: false,
        archivedAt: new Date(),
        permissions: {
          post: 'everyone',
          reply: 'everyone',
          mentionEveryone: 'everyone',
        },
        membership: {
          role: 'member',
          starredAt: null,
          sectionId: null,
          notify: null,
          mutedAt: null,
          closedAt: null,
        },
      },
    }));

    expect(await service.list(bob, 'canvas')).toEqual([]);
    await expect(start(service)).rejects.toMatchObject({
      code: 'CHANNEL_ARCHIVED',
    });
  });
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)(
  'CanvasCommentsService with Postgres',
  () => {
    const canvases = new CanvasesService(
      new PrismaCanvasesRepository(prisma),
      new PrismaRoomsRepository(prisma),
      new PrismaWorkspaceMembersRepository(prisma),
      new FakeLiveblocksGateway(),
      new PrismaCanvasVersionsRepository(prisma)
    );
    const service = new CanvasCommentsService(
      canvases,
      new PrismaCanvasCommentsRepository(prisma)
    );
    const run = crypto.randomUUID();
    const users = { owner: `${run}-owner`, viewer: `${run}-viewer` };
    const scope = (userId: string): CanvasViewerScope => ({
      userId,
      organizationId: run,
      workspaceRole: 'member',
    });
    const owner = scope(users.owner);
    const viewer = scope(users.viewer);

    beforeAll(async () => {
      await prisma.user.createMany({
        data: Object.values(users).map((id) => ({
          id,
          name: id,
          email: `${id}@test.local`,
        })),
      });
      await prisma.organization.create({
        data: {
          id: run,
          name: 'Acme',
          slug: `acme-${run}`,
          createdAt: new Date(),
        },
      });
      await prisma.member.createMany({
        data: Object.values(users).map((userId) => ({
          userId,
          organizationId: run,
          role: 'member',
          createdAt: new Date(),
        })),
      });
    });

    afterAll(async () => {
      await prisma.organization.deleteMany({ where: { id: run } });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(users) } },
      });
      await prisma.$disconnect();
    });

    it('stores a thread with its mentions and removes it with its canvas', async () => {
      const canvas = await canvases.create(owner, {});
      await canvases.share(owner, {
        canvasId: canvas.id,
        userIds: [users.viewer],
        role: 'viewer',
      });
      const thread = await service.createThread(owner, {
        canvasId: canvas.id,
        quote: 'Ship it',
        body: `Is this right, <@${users.viewer}>?`,
      });

      expect(await service.list(viewer, canvas.id)).toMatchObject([
        {
          id: thread.id,
          quote: 'Ship it',
          comments: [{ author: { id: users.owner } }],
        },
      ]);
      expect(
        await prisma.canvasComment.findFirst({
          where: { threadId: thread.id },
          select: { mentionedUserIds: true },
        })
      ).toEqual({ mentionedUserIds: [users.viewer] });

      await prisma.canvas.delete({ where: { id: canvas.id } });
      expect(
        await prisma.canvasCommentThread.count({ where: { id: thread.id } })
      ).toBe(0);
    });
  }
);
