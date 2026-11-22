import type { AskEvent, ModelAnswer } from '@conduit/contract';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AiAccessService } from '@/ai/application/ai-access.service';
import type { AiSettingsRepository } from '@/ai/domain/ai-settings.repository';
import type {
  ModelPort,
  ModelRequest,
  PartialObject,
} from '@/ai/domain/model.port';
import { ASK_REWRITE_PROMPT } from '@/ask/domain/ask-prompt';
import { PrismaAnswersRepository } from '@/ask/infrastructure/prisma-answers.repository';
import { PrismaAskAttachmentsRepository } from '@/ask/infrastructure/prisma-ask-attachments.repository';
import { PrismaAskContextRepository } from '@/ask/infrastructure/prisma-ask-context.repository';
import { FilesService } from '@/files/application/files.service';
import { PrismaFilesRepository } from '@/files/infrastructure/prisma-files.repository';
import { prisma } from '@/infrastructure/database/prisma.service';
import { PrismaMessagesRepository } from '@/messages/infrastructure/prisma-messages.repository';
import { NotificationSettingsService } from '@/notifications/application/notification-settings.service';
import { PrismaNotificationSettingsRepository } from '@/notifications/infrastructure/prisma-notification-settings.repository';
import { PrismaRoomsRepository } from '@/rooms/infrastructure/prisma-rooms.repository';
import { SearchService } from '@/search/application/search.service';
import { SearchSyncService } from '@/search/application/search-sync.service';
import { PrismaSearchRepository } from '@/search/infrastructure/prisma-search.repository';
import { PrismaSearchSyncRepository } from '@/search/infrastructure/prisma-search-sync.repository';
import { createFakeSearchIndex } from '@/search/testing/fake-search-index';
import { createFakeStorage } from '@/storage/testing/fake-object-storage';

import { AskService } from './ask.service';
import { AskAttachmentsService } from './ask-attachments.service';

vi.hoisted(() => {
  // The prisma singleton reads DATABASE_URL on import; never let tests reach the shared database.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
});

const connectionString = process.env.TEST_DATABASE_URL;

/**
 * A model that answers with fixed partial objects, after `gate` when given, and records what it was asked. A
 * follow-up's query rewrite gets `rewrite`, or throws when it is an error.
 */
function fakeModel(
  /** Or a function, read once the tools have run, for an answer that cites what they returned. */
  partials: PartialObject<ModelAnswer>[] | (() => PartialObject<ModelAnswer>[]),
  {
    gate,
    rewrite = 'rewritten query',
    tools,
  }: {
    gate?: Promise<void>;
    rewrite?: string | Error;
    /** Calls the request's tools before the answer, as a model would. */
    tools?: (request: ModelRequest<unknown>) => Promise<void>;
  } = {}
) {
  const requests: ModelRequest<unknown>[] = [];
  const model = {
    async *streamObject(request: ModelRequest<unknown>) {
      requests.push(request);
      if (request.system === ASK_REWRITE_PROMPT) {
        if (rewrite instanceof Error) throw rewrite;
        yield { query: rewrite };
        return;
      }
      await tools?.(request);
      const [first, ...rest] =
        typeof partials === 'function' ? partials() : partials;
      yield first;
      await gate;
      yield* rest;
    },
  } as unknown as ModelPort;
  return { model, requests };
}

async function collect(events: AsyncIterable<AskEvent>) {
  const all: AskEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

async function answerOf(run: { events: AsyncIterable<AskEvent> }) {
  const done = (await collect(run.events)).at(-1)!;
  if (done.type !== 'done') throw new Error('No answer.');
  return done.answer;
}

describe.skipIf(!connectionString)('AskService', () => {
  const run = crypto.randomUUID();
  const org = run;
  const ana = `${run}-ana`;
  const bao = `${run}-bao`;
  const room = (name: string) => `${run}-${name}`;
  const messages = new PrismaMessagesRepository(prisma);
  const answers = new PrismaAnswersRepository(prisma);
  const { index } = createFakeSearchIndex();
  const fileTexts: Record<string, string> = {};
  const sync = new SearchSyncService(
    new PrismaSearchSyncRepository(prisma),
    index,
    { extract: async (file) => fileTexts[file.key] ?? '' }
  );
  const search = new SearchService(
    new PrismaSearchRepository(prisma),
    index,
    new PrismaRoomsRepository(prisma),
    new NotificationSettingsService(
      new PrismaNotificationSettingsRepository(prisma)
    )
  );
  const viewerOf = (userId: string) => ({
    userId,
    organizationId: org,
    workspaceRole: 'member' as const,
  });
  const access = (aiEnabled: boolean) =>
    new AiAccessService({
      get: async () => ({ aiEnabled }),
    } as Partial<AiSettingsRepository> as AiSettingsRepository);
  const storage = createFakeStorage();
  const attachments = new AskAttachmentsService(
    access(true),
    new PrismaAskAttachmentsRepository(prisma),
    storage.storage,
    {
      extract: async (file) =>
        new TextDecoder().decode(await storage.storage.read(file.key)),
    },
    new FilesService(
      new PrismaFilesRepository(prisma),
      new PrismaRoomsRepository(prisma),
      storage.storage
    )
  );
  const service = (model: ModelPort, aiEnabled = true) =>
    new AskService(
      access(aiEnabled),
      model,
      search,
      answers,
      new PrismaAskContextRepository(prisma),
      attachments
    );
  /** Uploads a file as the browser would, and completes it. */
  const attach = async (
    userId: string,
    name: string,
    contentType: string,
    content: string
  ) => {
    const bytes = new TextEncoder().encode(content);
    const { attachmentId } = await attachments.uploadUrl(viewerOf(userId), {
      name,
      contentType,
      size: bytes.length,
    });
    const { key } = (await prisma.askAttachment.findUnique({
      where: { id: attachmentId },
    }))!;
    storage.objects.set(key!, bytes.length);
    storage.bytes.set(key!, bytes);
    await attachments.complete(viewerOf(userId), { attachmentId });
    return attachmentId;
  };
  const ids: Record<string, string> = {};
  const mentions = { userIds: [], channel: false, here: false };

  const send = async (
    key: string,
    roomId: string,
    body: string,
    { parentId, fileIds = [] }: { parentId?: string; fileIds?: string[] } = {}
  ) => {
    const { message } = await messages.send({
      roomId,
      authorId: bao,
      clientId: key,
      body,
      parentId,
      mentions,
      fileIds,
      items: () => [],
    });
    ids[key] = message.id;
  };

  const sendFile = async (key: string, roomId: string, text: string) => {
    const id = `${run}-${key}`;
    fileTexts[`files/${id}`] = text;
    await prisma.file.create({
      data: {
        id,
        organizationId: org,
        uploaderId: bao,
        roomId,
        name: `${key}.pdf`,
        contentType: 'application/pdf',
        size: 10,
        key: `files/${id}`,
        status: 'READY',
      },
    });
    await send(`with-${key}`, roomId, '', { fileIds: [id] });
  };

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: ana, name: 'Ana Silva', email: `${ana}@test.local` },
        { id: bao, name: 'Bao Tran', email: `${bao}@test.local` },
      ],
    });
    await prisma.organization.create({
      data: { id: org, name: org, slug: `s-${org}`, createdAt: new Date() },
    });
    await prisma.member.createMany({
      data: [ana, bao].map((userId) => ({
        userId,
        organizationId: org,
        role: 'member',
        createdAt: new Date(),
      })),
    });
    await prisma.room.create({
      data: {
        id: room('design'),
        organizationId: org,
        name: `design-${run}`,
        members: { create: [{ userId: ana }, { userId: bao }] },
      },
    });
    await prisma.room.create({
      data: {
        id: room('secret'),
        organizationId: org,
        name: `secret-${run}`,
        visibility: 'PRIVATE',
        members: { create: [{ userId: bao }] },
      },
    });

    await prisma.room.create({
      data: {
        id: room('dm'),
        organizationId: org,
        name: `dm-${run}`,
        kind: 'DM',
        dmKey: `${org}:${ana}:${bao}`,
        visibility: 'PRIVATE',
        members: { create: [{ userId: ana }, { userId: bao }] },
      },
    });

    await send('root', room('design'), 'Should the starter plan change?');
    await send('payroll', room('dm'), 'Payroll is due Friday');
    await send('reply', room('design'), 'Starter stays at 10 dollars', {
      parentId: ids.root,
    });
    await send('secret', room('secret'), 'Enterprise goes to 90 dollars');
    await send('deleted', room('design'), 'Starter was 8 dollars');
    await sendFile('deck', room('design'), 'The deck says Pro costs 20.');
    await sendFile('q3', room('secret'), 'The Q3 sheet says Team costs 40.');
    await sync.drain({ organizationId: org });
    // The index still holds it, as it would before it catches up.
    await prisma.message.update({
      where: { id: ids.deleted },
      data: { deletedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: org } });
    await prisma.user.deleteMany({ where: { id: { in: [ana, bao] } } });
    await prisma.$disconnect();
  });

  it('reads only what the asker can read, with the root of each thread', async () => {
    const { model, requests } = fakeModel([{ found: false, body: '' }]);
    const asked = await service(model).question(viewerOf(ana), {
      question: 'What do plans cost?',
    });
    await collect(asked.events);

    const prompt = requests[0]!.prompt;
    expect(prompt).toContain('Starter stays at 10 dollars');
    expect(prompt).toContain('Should the starter plan change?');
    expect(prompt).toContain('The deck says Pro costs 20.');
    expect(prompt).not.toContain('Enterprise');
    expect(prompt).not.toContain('Team costs 40');
    expect(prompt).not.toContain('8 dollars');
    expect(prompt).toMatch(/<question>\nWhat do plans cost\?\n<\/question>$/);
  });

  it('renumbers citations, drops one to a source that does not exist, and stores the answer', async () => {
    const { model, requests } = fakeModel([
      { found: true },
      { found: true, body: 'Pro costs 20 [99][1].' },
    ]);
    const asked = await service(model).question(viewerOf(ana), {
      question: 'What does Pro cost?',
    });
    const events = await collect(asked.events);
    const done = events.at(-1)!;
    if (done.type !== 'done') throw new Error('No answer.');

    expect(done.answer.found).toBe(true);
    expect(done.answer.body).toBe('Pro costs 20 [1].');
    expect(done.answer.sources).toHaveLength(1);
    // Source 1 in the prompt is the one the answer now cites.
    const first = requests[0]!.prompt.match(/<source n="1" type="(\w+)"/)![1];
    expect(done.answer.sources[0]!.type).toBe(first);
    expect(
      (await service(model).chat(viewerOf(ana), done.answer.chatId)).answers
    ).toMatchObject([{ body: 'Pro costs 20 [1].', found: true }]);
  });

  it('stores an answer with found false when the sources do not answer', async () => {
    const { model } = fakeModel([{ found: false, body: '' }]);
    const asked = await service(model).question(viewerOf(ana), {
      question: 'Who won the match?',
    });
    const done = (await collect(asked.events)).at(-1)!;
    if (done.type !== 'done') throw new Error('No answer.');

    expect(done.answer).toMatchObject({ found: false, body: '', sources: [] });
    expect(
      await prisma.answer.findUnique({ where: { id: done.answer.id } })
    ).toMatchObject({ found: false, sources: [] });
  });

  it('stores the answer when the reader stops reading midway', async () => {
    let open = () => {};
    const gate = new Promise<void>((resolve) => (open = resolve));
    const { model } = fakeModel(
      [
        { found: true, body: 'Pro' },
        { found: true, body: 'Pro costs 20 [1].' },
      ],
      { gate }
    );
    const asked = await service(model).question(viewerOf(ana), {
      question: 'Is Pro cheap?',
    });
    const events = asked.events[Symbol.asyncIterator]();
    expect((await events.next()).value).toMatchObject({
      type: 'partial',
      body: 'Pro',
    });
    await events.return?.(undefined);
    open();
    await asked.settled;

    expect(
      await prisma.answer.findFirst({
        where: { chat: { ownerId: ana }, question: 'Is Pro cheap?' },
      })
    ).toMatchObject({ found: true, body: 'Pro costs 20 [1].' });
  });

  it('lets only the owner read, continue, or delete a chat', async () => {
    const { model } = fakeModel([{ found: true, body: 'Pro costs 20 [1].' }]);
    const answer = await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'Price of Pro?',
      })
    );

    await expect(
      service(model).chat(viewerOf(bao), answer.chatId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service(model).question(viewerOf(bao), {
        chatId: answer.chatId,
        question: 'And Starter?',
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service(model).deleteChat(viewerOf(bao), answer.chatId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      (await service(model).chats(viewerOf(bao))).map((chat) => chat.id)
    ).not.toContain(answer.chatId);
  });

  it('answers a follow-up with the earlier turns of its own chat only', async () => {
    const first = fakeModel([{ found: true, body: 'Pro costs 20 [1].' }]);
    const opening = await answerOf(
      await service(first.model).question(viewerOf(ana), {
        question: 'What does Pro cost?',
      })
    );
    await answerOf(
      await service(first.model).question(viewerOf(ana), {
        question: 'Who chose the deck colors?',
      })
    );

    const { model, requests } = fakeModel([
      { found: true, body: 'Starter stays at 10 dollars [1].' },
    ]);
    const followUp = await answerOf(
      await service(model).question(viewerOf(ana), {
        chatId: opening.chatId,
        question: 'And Starter?',
      })
    );

    expect(requests[0]!.system).toBe(ASK_REWRITE_PROMPT);
    expect(requests[0]!.prompt).toContain('What does Pro cost?');
    const prompt = requests[1]!.prompt;
    expect(prompt).toContain(
      '<earlier>\n<turn>\n<question>\nWhat does Pro cost?\n</question>\n<answer>\nPro costs 20.\n</answer>'
    );
    expect(prompt).not.toContain('deck colors');
    expect(followUp.chatId).toBe(opening.chatId);

    const chat = await service(model).chat(viewerOf(ana), opening.chatId);
    expect(chat).toMatchObject({
      title: 'What does Pro cost?',
      answers: [
        { question: 'What does Pro cost?' },
        { question: 'And Starter?' },
      ],
    });
    expect((await service(model).chats(viewerOf(ana)))[0]!.id).toBe(
      opening.chatId
    );
  });

  it('asks the first question of a chat with no rewrite', async () => {
    const { model, requests } = fakeModel([{ found: false, body: '' }]);
    await answerOf(
      await service(model).question(viewerOf(ana), { question: 'Pro?' })
    );

    expect(requests.map((request) => request.system)).not.toContain(
      ASK_REWRITE_PROMPT
    );
  });

  it('searches the last question and the follow-up together when the rewrite fails', async () => {
    const first = fakeModel([{ found: true, body: 'Pro costs 20 [1].' }]);
    const opening = await answerOf(
      await service(first.model).question(viewerOf(ana), {
        question: 'Pro price?',
      })
    );
    const passages = vi.spyOn(search, 'passages');
    const { model } = fakeModel([{ found: false, body: '' }], {
      rewrite: new Error('provider down'),
    });
    await answerOf(
      await service(model).question(viewerOf(ana), {
        chatId: opening.chatId,
        question: 'and Starter?',
      })
    );

    expect(passages).toHaveBeenLastCalledWith(
      org,
      expect.any(Array),
      'Pro price? and Starter?',
      expect.any(Number)
    );
    passages.mockRestore();
  });

  it('stores no chat when the first answer fails', async () => {
    const model = {
      // eslint-disable-next-line require-yield
      async *streamObject() {
        throw new Error('provider down');
      },
    } as unknown as ModelPort;
    const asked = await service(model).question(viewerOf(bao), {
      question: 'A question that fails',
    });
    await expect(collect(asked.events)).rejects.toThrow('provider down');
    await asked.settled;

    expect(
      await prisma.askChat.count({
        where: { ownerId: bao, title: 'A question that fails' },
      })
    ).toBe(0);
  });

  it('refuses a question once the chat is full', async () => {
    const { model } = fakeModel([{ found: false, body: '' }]);
    const opening = await answerOf(
      await service(model).question(viewerOf(bao), { question: 'Full chat' })
    );
    await prisma.answer.createMany({
      data: Array.from({ length: 49 }, (_, n) => ({
        chatId: opening.chatId,
        question: `Turn ${n}`,
        found: false,
        body: '',
        sources: [],
      })),
    });

    await expect(
      service(model).question(viewerOf(bao), {
        chatId: opening.chatId,
        question: 'One more?',
      })
    ).rejects.toMatchObject({ code: 'CHAT_FULL' });
  });

  it('deletes a chat with its answers', async () => {
    const { model } = fakeModel([{ found: false, body: '' }]);
    const answer = await answerOf(
      await service(model).question(viewerOf(ana), { question: 'Delete me' })
    );
    await service(model).deleteChat(viewerOf(ana), answer.chatId);

    await expect(
      service(model).chat(viewerOf(ana), answer.chatId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await prisma.answer.count({ where: { id: answer.id } })).toBe(0);
  });

  it('refuses when the workspace turned AI off', async () => {
    const { model, requests } = fakeModel([]);
    await expect(
      service(model, false).question(viewerOf(ana), { question: 'Anything?' })
    ).rejects.toMatchObject({ code: 'AI_DISABLED' });
    expect(requests).toHaveLength(0);
  });

  it('keeps every direct message out, even one the asker is in', async () => {
    let searched = '';
    const { model, requests } = fakeModel([{ found: false, body: '' }], {
      tools: async (request) => {
        searched = await request.tools!.search!.execute({ query: 'Payroll' });
      },
    });
    await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'When is payroll due?',
      })
    );

    expect(requests.at(-1)!.prompt).not.toContain('Payroll is due');
    expect(searched).not.toContain('Payroll is due');
  });

  it('cites what a tool reads, and reads it back when the chat reopens', async () => {
    const results: Record<string, string> = {};
    const { model } = fakeModel(
      () => {
        const n = results.design!.match(/<source n="(\d+)" type="channel"/)![1];
        return [
          { found: true, body: `Ana Silva and Bao Tran are in design [${n}].` },
        ];
      },
      {
        tools: async ({ tools }) => {
          results.design = await tools!.channel!.execute({ name: 'design' });
          results.secret = await tools!.channel!.execute({ name: 'secret' });
          results.people = await tools!.people!.execute({ name: 'Bao' });
        },
      }
    );

    const answer = await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'Who is in design?',
      })
    );

    expect(results.design).toContain('Ana Silva');
    expect(results.design).toContain('Bao Tran');
    expect(results.secret).toBe('Nothing found.');
    expect(results.people).toContain('role="member"');
    expect(results.people).not.toContain('@test.local');
    expect(answer).toMatchObject({
      found: true,
      body: 'Ana Silva and Bao Tran are in design [1].',
      sources: [{ type: 'channel', channel: { id: room('design') } }],
    });
    expect(
      (await service(model).chat(viewerOf(ana), answer.chatId)).answers[0]
    ).toMatchObject({
      sources: [{ type: 'channel', channel: { id: room('design') } }],
    });
  });

  it('cites a guide article it reads, and reads it back when the chat reopens', async () => {
    const results: Record<string, string> = {};
    const { model, requests } = fakeModel(
      () => {
        const n = results.guide!.match(
          /<source n="(\d+)" type="guide" slug="what-is-conduit"/
        )![1];
        return [{ found: true, body: `Conduit is team chat [${n}].` }];
      },
      {
        tools: async ({ tools }) => {
          results.guide = await tools!.guide!.execute({
            slugs: ['what-is-conduit', 'no-such-article'],
          });
        },
      }
    );

    const answer = await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'What is Conduit?',
      })
    );

    expect(requests.at(-1)!.system).toContain('- what-is-conduit: ');
    expect(results.guide).toContain('team chat with the work built in');
    expect(results.guide).not.toContain('no-such-article');
    const cited = [
      {
        type: 'guide',
        article: { slug: 'what-is-conduit', title: 'What Conduit is' },
      },
    ];
    expect(answer).toMatchObject({
      found: true,
      body: 'Conduit is team chat [1].',
      sources: cited,
    });
    expect(
      (await service(model).chat(viewerOf(ana), answer.chatId)).answers[0]
    ).toMatchObject({ body: 'Conduit is team chat [1].', sources: cited });
  });

  it('drops a cited guide article that no longer exists when the chat reopens', async () => {
    const stored = await answers.addAnswer(
      {
        newChat: { organizationId: org, ownerId: ana, title: 'Old guide' },
      },
      {
        question: 'How big can a file be?',
        found: true,
        body: 'Removed [1]. Still here [2].',
        sources: [
          { type: 'guide', id: 'removed-article' },
          { type: 'guide', id: 'files' },
        ],
        attachmentIds: [],
      }
    );

    const { model } = fakeModel([]);
    const [reloaded] = (await service(model).chat(viewerOf(ana), stored.chatId))
      .answers;

    expect(reloaded).toMatchObject({
      body: 'Removed. Still here [1].',
      sources: [
        {
          type: 'guide',
          article: { slug: 'files', title: 'Files and uploads' },
        },
      ],
    });
  });

  it('opens a guide article by slug, and refuses one that does not exist', async () => {
    const { model } = fakeModel([]);
    await expect(
      service(model).guide(viewerOf(ana), 'search')
    ).resolves.toMatchObject({
      slug: 'search',
      title: 'Search and the command menu',
    });
    await expect(
      service(model).guide(viewerOf(ana), 'no-such-article')
    ).rejects.toMatchObject({ code: 'ARTICLE_NOT_FOUND' });
  });

  it("reads the asker's own saved messages and drafts, never one in a DM", async () => {
    await prisma.savedMessage.createMany({
      data: [
        { userId: ana, messageId: ids.reply! },
        { userId: ana, messageId: ids.payroll! },
        { userId: bao, messageId: ids.root! },
      ],
    });
    await prisma.draft.createMany({
      data: [
        { userId: ana, roomId: room('design'), body: 'Draft about pricing' },
        { userId: ana, roomId: room('dm'), body: 'Draft to Bao alone' },
        { userId: bao, roomId: room('design'), body: 'Bao draft' },
      ],
    });
    const results: Record<string, string> = {};
    const { model } = fakeModel([{ found: false, body: '' }], {
      tools: async ({ tools }) => {
        results.saved = await tools!.saved!.execute({});
        results.drafts = await tools!.drafts!.execute({ query: 'pricing' });
      },
    });
    await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'What did I save?',
      })
    );

    expect(results.saved).toContain('Starter stays at 10 dollars');
    expect(results.saved).not.toContain('Payroll');
    expect(results.saved).not.toContain('Should the starter plan change?');
    expect(results.drafts).toContain('Draft about pricing');
    expect(results.drafts).not.toContain('Bao');
  });

  it('answers from attached files, and shows them when the chat reopens', async () => {
    const image = await attach(ana, 'receipt.png', 'image/png', 'png bytes');
    const notes = await attach(
      ana,
      'notes.md',
      'text/markdown',
      'The launch moves to Tuesday.'
    );
    const { model, requests } = fakeModel([
      { found: true, body: 'The launch moves to Tuesday, as notes.md says.' },
    ]);
    const answer = await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'When is the launch?',
        attachmentIds: [image, notes],
      })
    );

    const request = requests.at(-1)!;
    expect(request.images).toEqual([
      { mediaType: 'image/png', data: new TextEncoder().encode('png bytes') },
    ]);
    expect(request.prompt).toContain(
      '<attachment name="receipt.png" type="image">\nPicture 1 sent with the question.\n</attachment>'
    );
    expect(request.prompt).toContain(
      '<attachment name="notes.md" type="document">\nThe launch moves to Tuesday.\n</attachment>'
    );
    // It cites no source, and still answers, because it read the attachments.
    expect(answer).toMatchObject({ found: true, sources: [] });
    expect(answer.attachments.map((a) => a.name)).toEqual([
      'receipt.png',
      'notes.md',
    ]);

    const chat = await service(model).chat(viewerOf(ana), answer.chatId);
    expect(chat.answers[0]!.attachments).toEqual([
      expect.objectContaining({
        id: image,
        url: expect.stringMatching(
          /^https:\/\/download\.test\/ask\/.*\?inline$/
        ),
      }),
      expect.objectContaining({ id: notes }),
    ]);

    const followUp = fakeModel([{ found: false, body: '' }]);
    await collect(
      (
        await service(followUp.model).question(viewerOf(ana), {
          chatId: answer.chatId,
          question: 'And the deck?',
        })
      ).events
    );
    const asked = followUp.requests.at(-1)!;
    expect(asked.images).toEqual([]);
    expect(asked.prompt).toContain(
      '<attached>receipt.png, notes.md</attached>'
    );
    expect(asked.prompt).not.toContain('<attachment ');
  });

  it("refuses an attachment that is another asker's, unfinished, or already sent", async () => {
    const { model } = fakeModel([{ found: false, body: '' }]);
    const baos = await attach(bao, 'b.txt', 'text/plain', 'Bao only');
    await expect(
      service(model).question(viewerOf(ana), {
        question: 'What does it say?',
        attachmentIds: [baos],
      })
    ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
    await expect(
      attachments.complete(viewerOf(ana), { attachmentId: baos })
    ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });

    const { attachmentId: unfinished } = await attachments.uploadUrl(
      viewerOf(ana),
      { name: 'big.pdf', contentType: 'application/pdf', size: 100 }
    );
    await expect(
      attachments.complete(viewerOf(ana), { attachmentId: unfinished })
    ).rejects.toMatchObject({ code: 'UPLOAD_MISSING' });
    await expect(
      service(model).question(viewerOf(ana), {
        question: 'What does it say?',
        attachmentIds: [unfinished],
      })
    ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });

    const sent = await attach(ana, 'a.txt', 'text/plain', 'Ana only');
    await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'What does it say?',
        attachmentIds: [sent],
      })
    );
    await expect(
      service(model).question(viewerOf(ana), {
        question: 'And again?',
        attachmentIds: [sent],
      })
    ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
  });

  it("attaches a private channel's file in place, and stops reading it once the asker leaves", async () => {
    const q3 = `${run}-q3`;
    storage.bytes.set(
      `files/${q3}`,
      new TextEncoder().encode('The Q3 sheet says Team costs 40.')
    );
    const objects = storage.objects.size;

    const picked = await attachments.attachFile(viewerOf(bao), q3);
    expect(picked).toMatchObject({ name: 'q3.pdf', available: true });
    expect(picked.url).toMatch(/files\/.*q3\?inline$/);
    expect(storage.objects.size).toBe(objects);

    const { model, requests } = fakeModel([
      { found: true, body: 'Team costs 40.' },
    ]);
    const answer = await answerOf(
      await service(model).question(viewerOf(bao), {
        question: 'What does Team cost?',
        attachmentIds: [picked.id],
      })
    );
    expect(requests.at(-1)!.prompt).toContain(
      'The Q3 sheet says Team costs 40.'
    );

    const unsent = await attachments.attachFile(viewerOf(bao), q3);
    await prisma.roomMember.deleteMany({
      where: { roomId: room('secret'), userId: bao },
    });
    try {
      const chat = await service(model).chat(viewerOf(bao), answer.chatId);
      expect(chat.answers[0]!.attachments).toEqual([
        expect.objectContaining({ id: picked.id, available: false, url: null }),
      ]);
      await expect(
        service(model).question(viewerOf(bao), {
          chatId: answer.chatId,
          question: 'And now?',
          attachmentIds: [unsent.id],
        })
      ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
    } finally {
      await prisma.roomMember.create({
        data: { roomId: room('secret'), userId: bao },
      });
    }
  });

  it("refuses a DM's file, another channel's file the asker can't read, and a video", async () => {
    const file = async (key: string, roomId: string, contentType: string) => {
      const id = `${run}-${key}`;
      await prisma.file.create({
        data: {
          id,
          organizationId: org,
          uploaderId: bao,
          roomId,
          name: key,
          contentType,
          size: 10,
          key: `files/${id}`,
          status: 'READY',
        },
      });
      await send(`with-${key}`, roomId, '', { fileIds: [id] });
      return id;
    };
    const inDm = await file('dm.pdf', room('dm'), 'application/pdf');
    const clip = await file('clip.mp4', room('design'), 'video/mp4');

    await expect(
      attachments.attachFile(viewerOf(ana), inDm)
    ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
    await expect(
      attachments.attachFile(viewerOf(ana), `${run}-q3`)
    ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
    await expect(
      attachments.attachFile(viewerOf(ana), clip)
    ).rejects.toMatchObject({ code: 'ATTACHMENT_REJECTED' });
  });

  it('accepts only images, PDFs and text files it can read', async () => {
    await expect(
      attachments.uploadUrl(viewerOf(ana), {
        name: 'clip.mp4',
        contentType: 'video/mp4',
        size: 10,
      })
    ).rejects.toMatchObject({ code: 'ATTACHMENT_REJECTED' });
    await expect(
      attachments.uploadUrl(viewerOf(ana), {
        name: 'huge.png',
        contentType: 'image/png',
        size: 6 * 1024 * 1024,
      })
    ).rejects.toMatchObject({
      code: 'ATTACHMENT_REJECTED',
      message: 'Images can be up to 5 MB here. This one is 6 MB.',
    });
  });

  it("sweeps an unsent upload after a day, and a deleted chat's files", async () => {
    const unsent = await attach(ana, 'old.txt', 'text/plain', 'Old');
    const sent = await attach(ana, 'kept.txt', 'text/plain', 'Kept');
    const { model } = fakeModel([{ found: true, body: 'Kept says Kept.' }]);
    const answer = await answerOf(
      await service(model).question(viewerOf(ana), {
        question: 'What does it say?',
        attachmentIds: [sent],
      })
    );
    const keyOf = async (id: string) =>
      (await prisma.askAttachment.findUnique({ where: { id } }))?.key;
    const unsentKey = (await keyOf(unsent))!;
    const sentKey = (await keyOf(sent))!;

    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    await attachments.sweep(tomorrow);
    expect(await keyOf(unsent)).toBeUndefined();
    expect(storage.objects.has(unsentKey)).toBe(false);
    expect(await keyOf(sent)).toBe(sentKey);

    await service(model).deleteChat(viewerOf(ana), answer.chatId);
    await attachments.sweep(tomorrow);
    expect(await keyOf(sent)).toBeUndefined();
    expect(storage.objects.has(sentKey)).toBe(false);
  });
});
