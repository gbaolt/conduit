import {
  FEED_DELETED_BODY,
  type FeedEntry,
  type ModelUrgency,
} from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AiAccessService } from '@/ai/application/ai-access.service';
import type { AiSettingsRepository } from '@/ai/domain/ai-settings.repository';
import type {
  ModelPort,
  ModelRequest,
  PartialObject,
} from '@/ai/domain/model.port';
import { prisma } from '@/infrastructure/database/prisma.service';

import type { FeedRepository, UnrankedItem } from '../domain/feed.repository';
import { PrismaFeedRepository } from '../infrastructure/prisma-feed.repository';
import { FeedService, type FeedViewer } from './feed.service';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const viewer: FeedViewer = { userId: 'u1', organizationId: 'org' };

const entry = (overrides: Partial<FeedEntry> = {}): FeedEntry => ({
  id: 'a1',
  kind: 'mention',
  room: { id: 'r1', name: 'design', kind: 'channel' },
  actor: { id: 'u2', name: 'Linh', image: null },
  message: { id: 'm1', parentId: null, body: 'x'.repeat(500), deletedAt: null },
  readAt: null,
  createdAt: new Date(0),
  ...overrides,
});

const accessFor = (aiEnabled: boolean) =>
  new AiAccessService({
    get: async () => ({ aiEnabled }),
  } as Partial<AiSettingsRepository> as AiSettingsRepository);

const unusedModel = {} as ModelPort;

function fakeService(page: Awaited<ReturnType<FeedRepository['list']>>) {
  const calls: unknown[][] = [];
  const repository = {
    list: async (input) => {
      calls.push(['list', input]);
      return page;
    },
    markRead: async (...args) => void calls.push(['markRead', ...args]),
    markAllRead: async (...args) => void calls.push(['markAllRead', ...args]),
  } as Partial<FeedRepository> as FeedRepository;
  return {
    service: new FeedService(repository, accessFor(true), unusedModel),
    calls,
  };
}

describe('FeedService with a fake repository', () => {
  it('cuts each message body to the excerpt and passes the caller and default page size', async () => {
    const { service, calls } = fakeService({
      entries: [
        entry(),
        entry({
          id: 'a2',
          message: {
            id: 'm2',
            parentId: null,
            body: '',
            deletedAt: new Date(),
          },
        }),
      ],
      hasMore: true,
    });

    const page = await service.list(viewer, { filter: 'unread' });

    expect(page.entries[0]?.message?.body).toHaveLength(280);
    expect(page.entries[1]?.message?.body).toBe(FEED_DELETED_BODY);
    expect(page.hasMore).toBe(true);
    expect(calls[0]).toEqual([
      'list',
      {
        userId: 'u1',
        organizationId: 'org',
        filter: 'unread',
        before: undefined,
        limit: 30,
      },
    ]);
  });

  it("refuses a cursor that is not the caller's item", async () => {
    const { service } = fakeService(null);

    await expect(
      service.list(viewer, { filter: 'all', before: 'someone-elses' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('marks read as the caller only', async () => {
    const { service, calls } = fakeService({ entries: [], hasMore: false });

    await service.markRead(viewer, ['a1', 'a2']);
    await service.markAllRead(viewer);

    expect(calls).toEqual([
      ['markRead', 'u1', ['a1', 'a2']],
      ['markAllRead', 'u1', 'org'],
    ]);
  });
});

const unranked = (
  id: string,
  overrides: Partial<UnrankedItem> = {}
): UnrankedItem => ({
  id,
  kind: 'mention',
  actorId: 'u2',
  body: 'can you review the invite flow today?',
  mentionedUserIds: ['u1'],
  sentAt: new Date('2026-11-13T09:00:00Z'),
  ...overrides,
});

function fakeRankService({
  items,
  aiEnabled = true,
  answer = { items: [] },
}: {
  items: UnrankedItem[];
  aiEnabled?: boolean;
  answer?: PartialObject<ModelUrgency>;
}) {
  const stored: Parameters<FeedRepository['setUrgency']>[] = [];
  const requests: ModelRequest<unknown>[] = [];
  const repository = {
    unranked: async () => items,
    userNames: async () =>
      new Map([
        ['u1', 'Bao'],
        ['u2', 'Linh'],
      ]),
    setUrgency: async (...args) => void stored.push(args),
  } as Partial<FeedRepository> as FeedRepository;
  const model = {
    async *streamObject(request: ModelRequest<unknown>) {
      requests.push(request);
      yield answer;
    },
  } as unknown as ModelPort;

  return {
    service: new FeedService(repository, accessFor(aiEnabled), model),
    stored,
    requests,
  };
}

describe('FeedService.rank with a fake model', () => {
  it('stores what the model rated, drops a label it was not shown, and tells it who the recipient is', async () => {
    const { service, stored, requests } = fakeRankService({
      items: [unranked('a1'), unranked('a2', { body: 'thanks!' })],
      answer: {
        items: [
          {
            label: 'm1',
            urgency: 'urgent',
            reason: 'Asks you a direct question',
          },
          { label: 'm2', urgency: 'low', reason: 'Just thanks' },
          { label: 'm9', urgency: 'urgent', reason: 'Never shown' },
        ],
      },
    });

    await service.rank(viewer);

    expect(stored).toEqual([
      [
        'u1',
        [
          { id: 'a1', urgency: 'urgent', reason: 'Asks you a direct question' },
          { id: 'a2', urgency: 'low', reason: 'Just thanks' },
        ],
      ],
    ]);
    expect(requests[0]?.prompt).toContain('<recipient>Bao</recipient>');
    expect(requests[0]?.maxOutputTokens).toBe(800);
  });

  it('refuses while AI is off, before it reads or calls anything', async () => {
    const { service, stored, requests } = fakeRankService({
      items: [unranked('a1')],
      aiEnabled: false,
    });

    await expect(service.rank(viewer)).rejects.toMatchObject({
      code: 'AI_DISABLED',
    });
    expect(stored).toEqual([]);
    expect(requests).toEqual([]);
  });

  it('does not call the model with nothing to judge', async () => {
    const { service, stored, requests } = fakeRankService({ items: [] });

    await service.rank(viewer);

    expect(requests).toEqual([]);
    expect(stored).toEqual([]);
  });

  it('fails as unavailable when the model rated nothing it was shown', async () => {
    const { service, stored } = fakeRankService({
      items: [unranked('a1')],
      answer: { items: [{ label: 'm9', urgency: 'low', reason: 'x' }] },
    });

    await expect(service.rank(viewer)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
    expect(stored).toEqual([]);
  });
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('FeedService against the database', () => {
  const repository = new PrismaFeedRepository(prisma);
  const service = new FeedService(repository, accessFor(true), unusedModel);
  const run = crypto.randomUUID();
  const organizationId = run;
  const [bo, ann, cy] = ['bo', 'ann', 'cy'].map((name) => `${run}-${name}`) as [
    string,
    string,
    string,
  ];
  const roomId = `${run}-room`;
  const leftRoomId = `${run}-left`;
  const asBo: FeedViewer = { userId: bo, organizationId };
  const sameInstant = new Date('2026-11-13T10:00:00Z');

  const item = (
    id: string,
    overrides: {
      userId?: string;
      roomId?: string;
      messageId?: string;
      key?: string;
      readAt?: Date;
    } = {}
  ) =>
    prisma.activityItem.create({
      data: {
        id: `${run}-${id}`,
        organizationId,
        userId: bo,
        roomId,
        kind: 'MENTION',
        key: `${run}-${id}`,
        actorId: ann,
        createdAt: sameInstant,
        ...overrides,
      },
    });
  const readAt = async (id: string) =>
    (await prisma.activityItem.findUniqueOrThrow({ where: { id } })).readAt;

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [bo, ann, cy].map((id) => ({
        id,
        name: id,
        email: `${id}@test.local`,
      })),
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'Acme',
        slug: `acme-${run}`,
        createdAt: new Date(),
      },
    });
    await prisma.room.createMany({
      data: [
        { id: roomId, organizationId, name: 'design' },
        { id: leftRoomId, organizationId, name: 'left' },
      ],
    });
    await prisma.roomMember.createMany({
      data: [
        { roomId, userId: bo },
        { roomId, userId: ann },
        { roomId, userId: cy },
      ],
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [bo, ann, cy] } } });
    await prisma.$disconnect();
  });

  it('pages newest first without skipping or repeating items that share a createdAt', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'].map((id) => `${run}-page-${id}`);
    for (const id of ids) await item(`page-${id.at(-1)}`);

    const first = await service.list(asBo, { filter: 'all', limit: 2 });
    const second = await service.list(asBo, {
      filter: 'all',
      limit: 2,
      before: first.entries.at(-1)?.id,
    });
    const third = await service.list(asBo, {
      filter: 'all',
      limit: 2,
      before: second.entries.at(-1)?.id,
    });

    const seen = [first, second, third].flatMap((page) =>
      page.entries.map((e) => e.id)
    );
    expect(seen).toEqual([...ids].sort().reverse());
    expect(first.hasMore).toBe(true);
    expect(third.hasMore).toBe(false);
  });

  it("refuses another member's item as a cursor", async () => {
    const theirs = await item('theirs', { userId: cy });

    await expect(
      service.list(asBo, { filter: 'all', before: theirs.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('hides items of a room the caller left, and the unread filter hides read ones', async () => {
    const read = await item('read', { readAt: new Date() });
    const hidden = await item('hidden', { roomId: leftRoomId });

    const all = await service.list(asBo, { filter: 'all', limit: 100 });
    const unread = await service.list(asBo, { filter: 'unread', limit: 100 });

    expect(all.entries.map((e) => e.id)).toContain(read.id);
    expect(all.entries.map((e) => e.id)).not.toContain(hidden.id);
    expect(unread.entries.map((e) => e.id)).not.toContain(read.id);
  });

  it("marks only the caller's own items read, and a repeat changes nothing", async () => {
    const mine = await item('mark-mine');
    const theirs = await item('mark-theirs', { userId: cy });

    await service.markRead(asBo, [mine.id, theirs.id]);
    const firstRead = await readAt(mine.id);
    await service.markRead(asBo, [mine.id]);

    expect(firstRead).not.toBeNull();
    expect(await readAt(mine.id)).toEqual(firstRead);
    expect(await readAt(theirs.id)).toBeNull();
  });

  it("marks every unread item of the caller read, and leaves other members'", async () => {
    const theirs = await item('all-theirs', { userId: cy });

    await service.markAllRead(asBo);

    const unread = await service.list(asBo, { filter: 'unread' });
    expect(unread.entries).toEqual([]);
    expect(await readAt(theirs.id)).toBeNull();
  });

  it('marks mentions read as the room read position reaches them, and no further', async () => {
    const message = (
      id: string,
      createdAt: Date,
      extra: { parentId?: string } = {}
    ) =>
      prisma.message.create({
        data: {
          id: `${run}-${id}`,
          roomId,
          authorId: ann,
          clientId: id,
          body: id,
          createdAt,
          ...extra,
        },
      });
    const early = await message('pos-early', new Date('2026-11-13T11:00:00Z'));
    const late = await message('pos-late', new Date('2026-11-13T12:00:00Z'));
    const reply = await message('pos-reply', new Date('2026-11-13T11:00:00Z'), {
      parentId: early.id,
    });
    const mentionOn = (id: string, messageId: string) =>
      item(id, { messageId, key: `message:${messageId}` });
    const onEarly = await mentionOn('pos-early-item', early.id);
    const onLate = await mentionOn('pos-late-item', late.id);
    const onReply = await mentionOn('pos-reply-item', reply.id);
    await prisma.readState.create({
      data: { roomId, userId: bo, lastReadAt: early.createdAt },
    });

    await repository.markReadThroughPosition({ roomId, userId: bo });

    expect(await readAt(onEarly.id)).not.toBeNull();
    expect(await readAt(onLate.id)).toBeNull();
    expect(await readAt(onReply.id)).toBeNull();
  });

  it("ranks only unread, unjudged mentions and replies in rooms the caller is in, and judges only the caller's own items", async () => {
    const { id: messageId } = await prisma.message.create({
      data: {
        id: `${run}-rank-m`,
        roomId,
        authorId: ann,
        clientId: 'rank',
        body: 'rank me',
      },
    });
    const ofKind = (
      id: string,
      extra: { userId?: string; roomId?: string } = {}
    ) => item(id, { messageId, key: `rank:${id}`, ...extra });
    const fresh = await ofKind('rank-fresh');
    const alreadyJudged = await ofKind('rank-judged');
    await prisma.activityItem.update({
      where: { id: alreadyJudged.id },
      data: { urgency: 'LOW' },
    });
    const left = await ofKind('rank-left', { roomId: leftRoomId });
    const theirs = await ofKind('rank-theirs', { userId: cy });

    const found = await repository.unranked({
      userId: bo,
      organizationId,
      limit: 20,
    });
    await repository.setUrgency(bo, [
      { id: fresh.id, urgency: 'urgent', reason: 'Asks you a direct question' },
      { id: theirs.id, urgency: 'urgent', reason: 'Not yours' },
    ]);

    expect(found.map((row) => row.id)).toContain(fresh.id);
    expect(found.map((row) => row.id)).not.toContain(alreadyJudged.id);
    expect(found.map((row) => row.id)).not.toContain(left.id);
    expect(found.map((row) => row.id)).not.toContain(theirs.id);
    const page = await service.list(asBo, { filter: 'all', limit: 100 });
    expect(page.entries.find((e) => e.id === fresh.id)).toMatchObject({
      urgency: 'urgent',
      urgencyReason: 'Asks you a direct question',
    });
    expect(
      (
        await prisma.activityItem.findUniqueOrThrow({
          where: { id: theirs.id },
        })
      ).urgency
    ).toBeNull();
  });
});
