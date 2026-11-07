import { addReaction, REACTION_EMOJI_MAX } from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/infrastructure/database/prisma.service';

import { PrismaMessagesRepository } from './prisma-messages.repository';

// vi.hoisted runs before the imports above.
vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)('PrismaMessagesRepository', () => {
  const repository = new PrismaMessagesRepository(prisma);
  const run = crypto.randomUUID();
  const organizationId = run;
  const userId = `${run}-user`;
  const channelId = `${run}-channel`;
  const mentions = { userIds: [], channel: false, here: false };

  const send = (clientId: string, body = clientId) =>
    repository.send({ channelId, authorId: userId, clientId, body, mentions });

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
    await prisma.channel.create({
      data: { id: channelId, organizationId, name: 'design' },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('stores a message, bumps lastMessageAt, and returns the transaction id', async () => {
    const { message, txid } = await send('first');

    expect(txid).toMatch(/^\d+$/);
    const channel = await prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
    });
    expect(channel.lastMessageAt).toEqual(message.createdAt);
  });

  it('returns the stored row for a retried clientId', async () => {
    const first = await send('retry', 'one');
    const again = await send('retry', 'two');

    expect(again.txid).toBeNull();
    expect(again.message.id).toBe(first.message.id);
    expect(again.message.body).toBe('one');
    expect(
      await prisma.message.count({ where: { channelId, clientId: 'retry' } })
    ).toBe(1);
  });

  it('pages newest first without skipping or repeating rows that share a createdAt', async () => {
    const paging = await prisma.channel.create({
      data: { organizationId, name: 'paging' },
    });
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    await prisma.message.createMany({
      data: ['a', 'b', 'c', 'd', 'e'].map((id) => ({
        id: `${run}-${id}`,
        channelId: paging.id,
        authorId: userId,
        clientId: id,
        body: id,
        createdAt,
      })),
    });

    const first = await repository.list(paging.id, { limit: 2 });
    const second = await repository.list(paging.id, {
      limit: 2,
      before: first?.messages.at(-1)?.id,
    });
    const third = await repository.list(paging.id, {
      limit: 2,
      before: second?.messages.at(-1)?.id,
    });

    const ids = [first, second, third].flatMap((page) =>
      page!.messages.map((message) => message.body)
    );
    expect(ids).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect([first?.hasMore, second?.hasMore, third?.hasMore]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('refuses a cursor from another channel', async () => {
    const { message } = await send('cursor');
    const other = await prisma.channel.create({
      data: { organizationId, name: 'other' },
    });

    await expect(
      repository.list(other.id, { limit: 10, before: message.id })
    ).resolves.toBeNull();
  });

  it('leaves a deleted message without replies out of the list', async () => {
    const { message } = await send('to-delete');
    await repository.markDeleted(message.id);

    const page = await repository.list(channelId, { limit: 100 });

    expect(page?.messages.map((m) => m.id)).not.toContain(message.id);
  });

  it('keeps every reaction when members react at the same time', async () => {
    const { message } = await send('reactions');
    const reactors = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      reactors.map((id) =>
        repository.updateReactions(message.id, (current) =>
          addReaction(current, '👍', id)
        )
      )
    );

    const stored = await repository.find(message.id);
    expect([...(stored?.reactions['👍'] ?? [])].sort()).toEqual(reactors);
  });

  it('refuses a new emoji past the cap without writing', async () => {
    const { message } = await send('cap');
    for (let i = 0; i < REACTION_EMOJI_MAX; i++) {
      await repository.updateReactions(message.id, (current) =>
        addReaction(current, `e${i}`, 'a')
      );
    }

    const refused = await repository.updateReactions(message.id, (current) =>
      addReaction(current, 'extra', 'a')
    );

    expect(refused).toBeNull();
    const stored = await repository.find(message.id);
    expect(Object.keys(stored?.reactions ?? {})).toHaveLength(
      REACTION_EMOJI_MAX
    );
  });

  it('pins, lists newest pin first, and unpins', async () => {
    const first = await send('pin-1');
    const second = await send('pin-2');
    await repository.setPinned(first.message.id, userId);
    await repository.setPinned(second.message.id, userId);

    const pinned = await repository.listPinned(channelId);
    expect(pinned.map((m) => m.id)).toEqual([
      second.message.id,
      first.message.id,
    ]);

    await repository.setPinned(second.message.id, null);
    const after = await repository.listPinned(channelId);
    expect(after.map((m) => m.id)).toEqual([first.message.id]);
  });

  it('bumps updatedAt on a reaction and a pin, so the live query carries them', async () => {
    const { message } = await send('bump');

    const reacted = await repository.updateReactions(message.id, (current) =>
      addReaction(current, '🎉', 'a')
    );
    const pinned = await repository.setPinned(message.id, userId);

    expect(reacted!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      message.updatedAt.getTime()
    );
    expect(pinned.updatedAt.getTime()).toBeGreaterThanOrEqual(
      reacted!.updatedAt.getTime()
    );
  });

  describe('threads', () => {
    const reply = (
      parentId: string,
      clientId: string,
      alsoSentToChannel = false
    ) =>
      repository.send({
        channelId,
        authorId: userId,
        clientId,
        body: clientId,
        mentions,
        parentId,
        alsoSentToChannel,
      });

    it('counts every reply sent at the same time', async () => {
      const { message: root } = await send('thread-root');

      await Promise.all(
        Array.from({ length: 8 }, (_, i) => reply(root.id, `race-${i}`))
      );

      const stored = await repository.find(root.id);
      expect(stored?.replyCount).toBe(8);
      expect(stored?.lastReplyAt).toBeInstanceOf(Date);
      expect(stored!.updatedAt.getTime()).toBeGreaterThan(
        root.updatedAt.getTime()
      );
    });

    it('counts a retried reply once', async () => {
      const { message: root } = await send('retry-root');

      await reply(root.id, 'same');
      const again = await reply(root.id, 'same');

      expect(again.txid).toBeNull();
      expect((await repository.find(root.id))?.replyCount).toBe(1);
    });

    it('keeps a reply out of the channel log unless it is also sent there', async () => {
      const { message: root } = await send('log-root');
      const quiet = await reply(root.id, 'quiet');
      const loud = await reply(root.id, 'loud', true);

      const page = await repository.list(channelId, { limit: 100 });
      const ids = page!.messages.map((message) => message.id);

      expect(ids).not.toContain(quiet.message.id);
      expect(ids).toContain(loud.message.id);
    });

    it('leaves lastMessageAt alone for a reply that stays in the thread', async () => {
      const { message: root } = await send('quiet-root');
      const before = await prisma.channel.findUniqueOrThrow({
        where: { id: channelId },
      });

      await reply(root.id, 'quiet-reply');

      const after = await prisma.channel.findUniqueOrThrow({
        where: { id: channelId },
      });
      expect(after.lastMessageAt).toEqual(before.lastMessageAt);
    });

    it('lists replies newest first, pages them, and drops a deleted one', async () => {
      const { message: root } = await send('page-root');
      const a = await reply(root.id, 'a');
      const b = await reply(root.id, 'b');
      const c = await reply(root.id, 'c');
      await repository.markDeleted(b.message.id);

      const first = await repository.listReplies(channelId, root.id, {
        limit: 1,
      });
      const second = await repository.listReplies(channelId, root.id, {
        limit: 1,
        before: first?.messages.at(-1)?.id,
      });

      expect(first?.messages.map((m) => m.id)).toEqual([c.message.id]);
      expect(first?.hasMore).toBe(true);
      expect(second?.messages.map((m) => m.id)).toEqual([a.message.id]);
      expect(second?.hasMore).toBe(false);
    });

    it('refuses a cursor from another thread', async () => {
      const { message: one } = await send('cursor-one');
      const { message: two } = await send('cursor-two');
      const inOne = await reply(one.id, 'in-one');

      await expect(
        repository.listReplies(channelId, two.id, {
          limit: 10,
          before: inOne.message.id,
        })
      ).resolves.toBeNull();
    });

    it('takes a deleted reply off the count once, even when deleted twice at once', async () => {
      const { message: root } = await send('count-root');
      const first = await reply(root.id, 'first');
      await reply(root.id, 'second');

      await Promise.all([
        repository.markDeleted(first.message.id),
        repository.markDeleted(first.message.id),
      ]);

      expect((await repository.find(root.id))?.replyCount).toBe(1);
    });

    it('keeps a deleted root with replies in the log', async () => {
      const { message: root } = await send('tomb-root');
      await reply(root.id, 'tomb-reply');
      await repository.markDeleted(root.id);

      const page = await repository.list(channelId, { limit: 100 });

      expect(page?.messages.map((m) => m.id)).toContain(root.id);
    });
  });
});
