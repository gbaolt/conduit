import type {
  Dm,
  Message,
  ModelSummary,
  Room,
  Summary,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { AiAccessService } from '@/ai/application/ai-access.service';
import type { AiSettingsRepository } from '@/ai/domain/ai-settings.repository';
import type {
  ModelPort,
  ModelRequest,
  PartialObject,
} from '@/ai/domain/model.port';
import type { DmsRepository } from '@/dms/domain/dms.repository';
import type { FeedRepository } from '@/feed/domain/feed.repository';
import {
  MessagesService,
  type MessageViewer,
} from '@/messages/application/messages.service';
import type { MessagesRepository } from '@/messages/domain/messages.repository';
import type { SavedMessagesRepository } from '@/messages/domain/saved-messages.repository';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';
import type {
  StoredSummary,
  SummariesRepository,
} from '@/summaries/domain/summaries.repository';

import { SummariesService } from './summaries.service';

const organizationId = 'org';
const viewerOf = (userId: string): MessageViewer => ({
  userId,
  organizationId,
  workspaceRole: 'member',
});
const linh = viewerOf('linh');
const bao = viewerOf('bao');
const outsider = viewerOf('outsider');

const channelFor = (
  role: 'member' | null,
  overrides: Partial<Room> = {}
): Room => ({
  id: 'c1',
  organizationId,
  kind: 'channel',
  name: 'design',
  topic: null,
  description: null,
  visibility: 'private',
  isDefault: false,
  archivedAt: null,
  memberCount: 2,
  createdById: null,
  createdAt: new Date(0),
  membership: role && {
    role,
    starredAt: null,
    sectionId: null,
    notify: null,
    mutedAt: null,
  },
  archivedByName: null,
  ...overrides,
});

const log: Message[] = [
  { id: 'cm-1', authorId: 'linh', body: 'Ship on Friday?' },
  { id: 'cm-2', authorId: 'bao', body: 'Yes, once docs land.' },
  { id: 'cm-3', authorId: 'linh', body: 'Docs land Thursday.' },
].map(
  (message, index) =>
    ({
      ...message,
      roomId: 'c1',
      clientId: message.id,
      parentId: null,
      alsoSentToChannel: false,
      mentionedUserIds: [],
      deletedAt: null,
      createdAt: new Date(index * 1000),
    }) as unknown as Message
);

/** A model that answers with fixed partial objects and records what it was asked. */
function fakeModel(...partials: PartialObject<ModelSummary>[]) {
  const requests: ModelRequest<unknown>[] = [];
  const model = {
    async *streamObject(request: ModelRequest<unknown>) {
      requests.push(request);
      yield* partials;
    },
  } as unknown as ModelPort;
  return { model, requests };
}

function setup({
  views,
  aiEnabled = true,
  messages = log,
  model = fakeModel({
    bullets: [{ text: 'Ship Friday.', sourceIds: ['m1', 'm2'] }],
  }).model,
}: {
  views: Record<string, Room | null>;
  aiEnabled?: boolean;
  messages?: Message[];
  model?: ModelPort;
}) {
  const sent: Parameters<MessagesRepository['send']>[0][] = [];
  const messageRepository = {
    listForSummary: async (_channelId, { from, to }) =>
      messages.filter(
        ({ createdAt }) =>
          (!from || createdAt >= from) && (!to || createdAt < to)
      ),
    find: async (id: string) => messages.find((m) => m.id === id) ?? null,
    send: async (input) => {
      sent.push(input);
      return {
        message: { id: 'shared-1', ...input } as unknown as Message,
        txid: '1',
      };
    },
  } as Partial<MessagesRepository> as MessagesRepository;

  const channels = {
    find: async (scope: { userId: string }) => views[scope.userId] ?? null,
  } as Partial<RoomsRepository> as RoomsRepository;

  const rows = new Map<string, StoredSummary>();
  const summaries: SummariesRepository = {
    create: async (input) => {
      const stored: StoredSummary = {
        ...input,
        id: `s${rows.size + 1}`,
        sharedMessageId: null,
        createdAt: new Date(0),
      };
      rows.set(stored.id, stored);
      return stored;
    },
    find: async (id) => rows.get(id) ?? null,
    setShared: async (id, messageId) => {
      const next = { ...rows.get(id)!, sharedMessageId: messageId };
      rows.set(id, next);
      return next;
    },
    userNames: async (ids) => new Map(ids.map((id) => [id, id])),
  };

  const settings: AiSettingsRepository = {
    get: async () => ({ aiEnabled }),
    set: async (_id, next) => next,
  };

  const messagesService = new MessagesService(
    messageRepository,
    channels,
    {} as SavedMessagesRepository,
    {} as DmsRepository,
    {
      recipientLookup: async () => ({
        memberIds: [],
        onlineIds: [],
        repliers: [],
      }),
    } as Partial<FeedRepository> as FeedRepository
  );

  return {
    service: new SummariesService(
      new AiAccessService(settings),
      model,
      messagesService,
      summaries
    ),
    rows,
    sent,
  };
}

async function finish(stream: AsyncIterable<{ type: string }>) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

const summaryOf = (events: { type: string }[]) =>
  (events.at(-1) as { type: 'done'; summary: Summary }).summary;

describe('SummariesService', () => {
  it('stores a summary that cites the messages the model read', async () => {
    const { service, rows } = setup({ views: { linh: channelFor('member') } });

    const events = await finish(
      await service.summarizeChannel(linh, {
        roomId: 'c1',
        from: new Date(0).toISOString(),
      })
    );

    expect(summaryOf(events)).toMatchObject({
      messageCount: 3,
      bullets: [{ text: 'Ship Friday.', sourceIds: ['cm-1', 'cm-2'] }],
      sourceMessageIds: ['cm-1', 'cm-2'],
      sharedMessageId: null,
    });
    expect(rows.size).toBe(1);
  });

  it('summarizes only the messages sent before the end of the range', async () => {
    const { service } = setup({ views: { linh: channelFor('member') } });
    const to = new Date(2000);

    const events = await finish(
      await service.summarizeChannel(linh, {
        roomId: 'c1',
        from: new Date(0).toISOString(),
        to: to.toISOString(),
      })
    );

    expect(summaryOf(events)).toMatchObject({
      messageCount: 2,
      from: new Date(0),
      to,
    });
  });

  it('drops a source id that was not in the input, and a bullet left with none', async () => {
    const { model } = fakeModel({
      bullets: [
        { text: 'Mixed.', sourceIds: ['m3', 'm99', 'cm-1'] },
        { text: 'Invented.', sourceIds: ['m99'] },
        { text: 'Uncited.', sourceIds: [] },
      ],
    });
    const { service } = setup({
      views: { linh: channelFor('member') },
      model,
    });

    const events = await finish(await service.summarizeThread(linh, 'cm-1'));

    expect(summaryOf(events).bullets).toEqual([
      { text: 'Mixed.', sourceIds: ['cm-3'] },
    ]);
  });

  it('streams the bullets as they grow, then the stored summary', async () => {
    const { model } = fakeModel(
      { bullets: [{ text: 'One.', sourceIds: ['m1'] }] },
      { bullets: [{ text: 'One.', sourceIds: ['m1'] }] },
      {
        bullets: [
          { text: 'One.', sourceIds: ['m1'] },
          { text: 'Two.', sourceIds: ['m2'] },
        ],
      }
    );
    const { service } = setup({
      views: { linh: channelFor('member') },
      model,
    });

    const events = await finish(await service.summarizeThread(linh, 'cm-1'));

    expect(events.map((event) => event.type)).toEqual([
      'partial',
      'partial',
      'done',
    ]);
  });

  it('caps what each call can spend, and never sends an id to the model', async () => {
    const { model, requests } = fakeModel({
      bullets: [{ text: 'a', sourceIds: ['m1'] }],
    });
    const { service } = setup({
      views: { linh: channelFor('member') },
      model,
    });

    await finish(await service.summarizeThread(linh, 'cm-1'));

    expect(requests[0]?.maxOutputTokens).toBeGreaterThan(0);
    expect(requests[0]?.prompt).not.toContain('cm-1');
  });

  it('reads a DM the requester is in', async () => {
    const { service } = setup({
      views: { linh: channelFor('member', { kind: 'dm', name: '' }) },
    });

    const events = await finish(
      await service.summarizeChannel(linh, {
        roomId: 'c1',
        from: new Date(0).toISOString(),
      })
    );

    expect(summaryOf(events).messageCount).toBe(3);
  });

  it('refuses a private channel the requester left', async () => {
    const { service } = setup({
      views: { linh: channelFor('member'), bao: channelFor(null) },
    });

    await expect(
      service.summarizeChannel(bao, {
        roomId: 'c1',
        from: new Date(0).toISOString(),
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.summarizeThread(bao, 'cm-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses while AI is off, before it reaches the model', async () => {
    const { model, requests } = fakeModel();
    const { service } = setup({
      views: { linh: channelFor('member') },
      aiEnabled: false,
      model,
    });

    await expect(service.summarizeThread(linh, 'cm-1')).rejects.toMatchObject({
      code: 'AI_DISABLED',
    });
    await expect(
      service.summarizeChannel(linh, {
        roomId: 'c1',
        from: '2026-01-01T00:00:00Z',
      })
    ).rejects.toMatchObject({ code: 'AI_DISABLED' });
    expect(requests).toHaveLength(0);
  });

  it('refuses a range with no messages', async () => {
    const { service } = setup({
      views: { linh: channelFor('member') },
      messages: [],
    });

    await expect(service.summarizeThread(linh, 'cm-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      service.summarizeChannel(linh, {
        roomId: 'c1',
        from: '2026-01-01T00:00:00Z',
      })
    ).rejects.toMatchObject({ code: 'NOTHING_TO_SUMMARIZE' });
  });

  it('stores nothing and reports AI_UNAVAILABLE when the model returns no cited bullet', async () => {
    const { model } = fakeModel({
      bullets: [{ text: 'Invented.', sourceIds: ['m99'] }],
    });
    const { service, rows } = setup({
      views: { linh: channelFor('member') },
      model,
    });

    await expect(
      finish(await service.summarizeThread(linh, 'cm-1'))
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(rows.size).toBe(0);
  });

  describe('who reads a summary', () => {
    const views = { linh: channelFor('member'), bao: channelFor('member') };

    async function linhsSummary() {
      const context = setup({ views });
      const events = await finish(
        await context.service.summarizeThread(linh, 'cm-1')
      );
      return { ...context, id: summaryOf(events).id };
    }

    it('lets only the requester read it until it is shared', async () => {
      const { service, id } = await linhsSummary();

      await expect(service.get(linh, id)).resolves.toMatchObject({ id });
      await expect(service.get(bao, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('does not let another member share it', async () => {
      const { service, id, sent } = await linhsSummary();

      await expect(service.share(bao, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(sent).toHaveLength(0);
    });

    it('hides it from a member of another workspace', async () => {
      const { service, id } = await linhsSummary();

      await expect(
        service.get({ ...bao, organizationId: 'other-org' }, id)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('stops showing it to a requester who lost the channel', async () => {
      const own = { ...views };
      const context = setup({ views: own });
      const events = await finish(
        await context.service.summarizeThread(linh, 'cm-1')
      );
      const id = summaryOf(events).id;
      own.linh = channelFor(null);

      await expect(context.service.get(linh, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('lets everyone who can read the channel read it once it is shared', async () => {
      const { service, id, sent } = await linhsSummary();

      const shared = await service.share(linh, id);

      expect(shared.sharedMessageId).toBe('shared-1');
      expect(sent[0]).toMatchObject({
        authorId: 'linh',
        roomId: 'c1',
        parentId: 'cm-1',
        clientId: `summary-${id}`,
      });
      expect(sent[0]?.body).toContain(
        '[1](/channels/c1?thread=cm-1&message=cm-1)'
      );
      await expect(service.get(bao, id)).resolves.toMatchObject({ id });
      await expect(service.get(outsider, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('shares once', async () => {
      const { service, id, sent } = await linhsSummary();

      await service.share(linh, id);
      await service.share(linh, id);

      expect(sent).toHaveLength(1);
    });
  });

  describe('catch-up', () => {
    const memberOf = (mutedAt: Date | null = null) =>
      ({
        role: 'member',
        starredAt: null,
        sectionId: null,
        notify: null,
        mutedAt,
      }) as Room['membership'];
    const channel = (id: string, name: string, extra: Partial<Room> = {}) =>
      channelFor('member', { id, name, visibility: 'public', ...extra });
    const dmRoom = () =>
      channelFor('member', { id: 'd1', kind: 'dm', name: '' });
    const dm = (id: string): Dm => ({
      id,
      members: [
        { userId: 'linh', name: 'Linh', image: null },
        { userId: 'bao', name: 'Bao', image: null },
      ],
      lastMessageAt: null,
      createdAt: new Date(0),
    });
    const post = (
      id: string,
      roomId: string,
      body: string,
      at: number,
      extra: Partial<Message> = {}
    ) =>
      ({
        id,
        roomId,
        authorId: 'bao',
        body,
        parentId: null,
        alsoSentToChannel: false,
        mentionedUserIds: [],
        createdAt: new Date(at),
        ...extra,
      }) as unknown as Message;

    function catchUpSetup({
      rooms,
      dms = [],
      messages,
      itemMessageIds = [],
    }: {
      rooms: Room[];
      dms?: Dm[];
      messages: Message[];
      itemMessageIds?: string[];
    }) {
      const asked: Parameters<MessagesRepository['listForCatchUp']>[0][] = [];
      const messageRepository = {
        listForCatchUp: async (input) => {
          asked.push(input);
          const inItems = new Set(itemMessageIds);
          const read = messages.filter(
            (m) =>
              (input.roomIds.includes(m.roomId) && !m.parentId) ||
              (inItems.has(m.id) && input.itemRoomIds.includes(m.roomId))
          );
          return {
            messages: read,
            itemMessageIds: read
              .map((m) => m.id)
              .filter((id) => inItems.has(id)),
          };
        },
      } as Partial<MessagesRepository> as MessagesRepository;
      const roomsRepository = {
        list: async () => rooms.filter((room) => room.kind === 'channel'),
        find: async (_scope: unknown, id: string) =>
          rooms.find((room) => room.id === id) ?? null,
      } as Partial<RoomsRepository> as RoomsRepository;

      const stored = new Map<string, StoredSummary>();
      const summaries = {
        create: async (input) => {
          const row = {
            ...input,
            id: `s${stored.size + 1}`,
            sharedMessageId: null,
            createdAt: new Date(0),
          } as StoredSummary;
          stored.set(row.id, row);
          return row;
        },
        find: async (id) => stored.get(id) ?? null,
        userNames: async (ids) => new Map(ids.map((id) => [id, id])),
      } as Partial<SummariesRepository> as SummariesRepository;

      const { model, requests } = fakeModel({
        bullets: [{ text: 'Ship Friday.', sourceIds: ['m1'] }],
      });
      const service = new SummariesService(
        new AiAccessService({
          get: async () => ({ aiEnabled: true }),
        } as Partial<AiSettingsRepository> as AiSettingsRepository),
        model,
        new MessagesService(
          messageRepository,
          roomsRepository,
          {} as SavedMessagesRepository,
          { list: async () => dms } as Partial<DmsRepository> as DmsRepository,
          {} as FeedRepository
        ),
        summaries
      );
      return { service, asked, stored, requests };
    }

    it('reads every unmuted room, a DM, and a thread reply behind an item, and stores no room', async () => {
      const { service, requests, stored } = catchUpSetup({
        rooms: [
          channel('c1', 'design', { membership: memberOf() }),
          channel('c2', 'ops', { membership: memberOf() }),
          dmRoom(),
        ],
        dms: [dm('d1')],
        messages: [
          post('a', 'c1', 'Ship on Friday?', 1000),
          post('b', 'c2', 'Deploy is green.', 2000),
          post('c', 'd1', 'Lunch?', 3000),
          post('t', 'c1', 'Can you review this reply?', 4000, {
            parentId: 'a',
          }),
        ],
        itemMessageIds: ['t'],
      });

      const events = await finish(await service.catchUp(linh));

      const prompt = requests[0]!.prompt;
      expect(prompt).toContain('room="#design"');
      expect(prompt).toContain('room="#ops"');
      expect(prompt).toContain('room="DM with Bao"');
      expect(prompt).toContain('Can you review this reply?');
      expect(requests[0]!.system).toContain('catch a team member up');
      expect(summaryOf(events)).toMatchObject({
        roomId: null,
        parentId: null,
        messageCount: 4,
        from: new Date(1000),
      });
      expect(stored.size).toBe(1);
    });

    it('leaves out a muted room, but keeps a mention that reached it', async () => {
      const { service, asked } = catchUpSetup({
        rooms: [
          channel('c1', 'design', { membership: memberOf() }),
          channel('c2', 'noise', { membership: memberOf(new Date(0)) }),
        ],
        messages: [
          post('a', 'c1', 'Ship on Friday?', 1000),
          post('n', 'c2', 'Lunch poll', 2000),
        ],
      });

      await finish(await service.catchUp(linh));

      expect(asked[0]?.roomIds).toEqual(['c1']);
      expect(asked[0]?.itemRoomIds).toEqual(['c1', 'c2']);
    });

    it('leaves out a channel the caller is no longer in', async () => {
      const { service, asked, requests } = catchUpSetup({
        rooms: [
          channel('c1', 'design', { membership: memberOf() }),
          channel('c3', 'left', { membership: null }),
        ],
        messages: [
          post('a', 'c1', 'Ship on Friday?', 1000),
          post('x', 'c3', 'Secret', 2000),
        ],
        itemMessageIds: ['x'],
      });

      await finish(await service.catchUp(linh));

      expect(asked[0]?.roomIds).toEqual(['c1']);
      expect(asked[0]?.itemRoomIds).toEqual(['c1']);
      expect(requests[0]!.prompt).not.toContain('Secret');
    });

    it('keeps DMs and messages behind items when the prompt is over its limit', async () => {
      const { service, requests } = catchUpSetup({
        rooms: [channel('c1', 'design', { membership: memberOf() }), dmRoom()],
        dms: [dm('d1')],
        messages: [
          post('a', 'c1', 'x'.repeat(40_000), 1000),
          post('b', 'c1', 'y'.repeat(40_000), 2000),
          post('c', 'd1', 'Lunch?', 500),
        ],
      });

      await finish(await service.catchUp(linh));

      expect(requests[0]!.prompt).toContain('Lunch?');
      expect(requests[0]!.prompt).toContain('y'.repeat(100));
      expect(requests[0]!.prompt).not.toContain('x'.repeat(100));
    });

    it('refuses with nothing to read, and while AI is off', async () => {
      const { service } = catchUpSetup({ rooms: [], messages: [] });
      await expect(service.catchUp(linh)).rejects.toMatchObject({
        code: 'NOTHING_TO_SUMMARIZE',
      });

      const off = setup({ views: {}, aiEnabled: false });
      await expect(off.service.catchUp(linh)).rejects.toMatchObject({
        code: 'AI_DISABLED',
      });
    });

    it('is read by its requester only, and cannot be shared', async () => {
      const { service, stored } = catchUpSetup({
        rooms: [channel('c1', 'design', { membership: memberOf() })],
        messages: [post('a', 'c1', 'Ship on Friday?', 1000)],
      });
      const id = summaryOf(await finish(await service.catchUp(linh))).id;

      await expect(service.get(linh, id)).resolves.toMatchObject({
        roomId: null,
      });
      await expect(service.get(bao, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(service.share(linh, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(stored.get(id)?.sharedMessageId).toBeNull();
    });
  });
});
