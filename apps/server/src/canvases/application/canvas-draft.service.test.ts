import type {
  CanvasDraftEvent,
  Message,
  ModelCanvasDraft,
  Room,
} from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { AiAccessService } from '@/ai/application/ai-access.service';
import type { AiSettingsRepository } from '@/ai/domain/ai-settings.repository';
import type {
  ModelPort,
  ModelRequest,
  PartialObject,
} from '@/ai/domain/model.port';
import type { CanvasesRepository } from '@/canvases/domain/canvases.repository';
import type { DmsRepository } from '@/dms/domain/dms.repository';
import type { FeedRepository } from '@/feed/domain/feed.repository';
import {
  MessagesService,
  type MessageViewer,
} from '@/messages/application/messages.service';
import type { MessagesRepository } from '@/messages/domain/messages.repository';
import type { SavedMessagesRepository } from '@/messages/domain/saved-messages.repository';
import type { ThreadsRepository } from '@/messages/domain/threads.repository';
import type { RoomsRepository } from '@/rooms/domain/rooms.repository';

import { CanvasDraftService } from './canvas-draft.service';

const organizationId = 'org';
const viewerOf = (userId: string): MessageViewer => ({
  userId,
  organizationId,
  workspaceRole: 'member',
});
const linh = viewerOf('linh');
const outsider = viewerOf('outsider');

const roomOf = (kind: Room['kind']): Room =>
  ({
    id: 'c1',
    organizationId,
    kind,
    name: 'product',
    visibility: 'private',
    permissions: {
      post: 'everyone',
      reply: 'everyone',
      mentionEveryone: 'everyone',
    },
    archivedAt: null,
    membership: { role: 'member' },
  }) as unknown as Room;

const thread: Message[] = [
  { id: 'root', parentId: null, authorId: 'linh', body: 'Spec for filters?' },
  { id: 'r1', parentId: 'root', authorId: 'bao', body: 'Author and date.' },
  { id: 'r2', parentId: 'root', authorId: 'linh', body: 'Bao ships Friday.' },
].map(
  (message, index) =>
    ({
      ...message,
      roomId: 'c1',
      mentionedUserIds: [],
      deletedAt: null,
      createdAt: new Date(index * 1000),
    }) as unknown as Message
);

const answer: PartialObject<ModelCanvasDraft>[] = [
  { title: 'Search' },
  {
    title: 'Search filters',
    sections: [{ heading: 'Scope', markdown: 'Author and date.' }],
  },
  {
    title: 'Search filters',
    sections: [
      {
        heading: 'Scope',
        markdown: 'Author and date.',
        sourceLabels: ['m2', 'm99'],
      },
    ],
    actionItems: [{ text: 'Bao ships Friday.', sourceLabel: 'm3' }],
  },
];

function fakeModel(...partials: PartialObject<ModelCanvasDraft>[]) {
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
  room = roomOf('channel'),
  aiEnabled = true,
  partials = answer,
}: {
  room?: Room;
  aiEnabled?: boolean;
  partials?: PartialObject<ModelCanvasDraft>[];
} = {}) {
  const { model, requests } = fakeModel(...partials);
  const messageRepository = {
    find: async (id: string) => thread.find((m) => m.id === id) ?? null,
    listForSummary: async () => thread,
  } as Partial<MessagesRepository> as MessagesRepository;
  const rooms = {
    find: async (scope: { userId: string }) =>
      scope.userId === 'outsider' ? null : room,
  } as Partial<RoomsRepository> as RoomsRepository;
  const settings: AiSettingsRepository = {
    get: async () => ({ aiEnabled }),
    set: async (_id, next) => next,
  };

  // Every canvas write goes through this port, so recording each call proves the draft writes nothing.
  const calls: string[] = [];
  const canvases = new Proxy({} as CanvasesRepository, {
    get: (_target, method: string) => async (ids: string[]) => {
      calls.push(method);
      if (method === 'userNames') return new Map(ids.map((id) => [id, id]));
      throw new Error(`unexpected ${method}`);
    },
  });

  const messages = new MessagesService(
    messageRepository,
    rooms,
    {} as SavedMessagesRepository,
    {} as DmsRepository,
    {} as FeedRepository,
    {} as ThreadsRepository
  );
  return {
    service: new CanvasDraftService(
      new AiAccessService(settings),
      model,
      messages,
      canvases
    ),
    requests,
    calls,
  };
}

async function finish(stream: AsyncIterable<CanvasDraftEvent>) {
  const events: CanvasDraftEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('CanvasDraftService', () => {
  it('streams partials, then a draft that links only messages the model read', async () => {
    const { service, requests, calls } = setup();

    const events = await finish(await service.draftFromThread(linh, 'root'));

    expect(events.slice(0, -1).every((e) => e.type === 'partial')).toBe(true);
    expect(events[1]).toMatchObject({
      type: 'partial',
      messageCount: 3,
      title: 'Search filters',
      markdown: '## Scope\n\nAuthor and date.',
    });
    const done = events.at(-1);
    expect(done).toMatchObject({
      type: 'done',
      draft: {
        title: 'Search filters',
        sourceThreadId: 'root',
        sourceMessageIds: ['r1', 'r2'],
      },
    });
    const markdown = done?.type === 'done' ? done.draft.markdown : '';
    expect(markdown).toContain('[1](/channels/c1?thread=root&message=r1)');
    expect(markdown).toContain(
      '- [ ] Bao ships Friday. [2](/channels/c1?thread=root&message=r2)'
    );
    expect(markdown).not.toContain('m99');
    expect(requests[0]?.prompt).toContain('<message id="m1" author="linh"');
    expect(calls).toEqual(['userNames']);
  });

  it('links a DM thread under /dms', async () => {
    const { service } = setup({ room: roomOf('dm') });

    const events = await finish(await service.draftFromThread(linh, 'root'));

    const done = events.at(-1);
    expect(done?.type === 'done' && done.draft.markdown).toContain(
      '/dms/c1?thread=root&message=r1'
    );
  });

  it('refuses with AI_DISABLED before reading the thread when AI is off', async () => {
    const { service, requests, calls } = setup({ aiEnabled: false });

    await expect(service.draftFromThread(linh, 'root')).rejects.toMatchObject({
      code: 'AI_DISABLED',
    });
    expect(requests).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('refuses with NOT_FOUND a thread in a private channel the viewer is not in', async () => {
    const { service, requests } = setup();

    await expect(
      service.draftFromThread(outsider, 'root')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(requests).toHaveLength(0);
  });

  it('refuses a reply, which is not a thread', async () => {
    const { service } = setup();

    await expect(service.draftFromThread(linh, 'r1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('fails as AI_UNAVAILABLE when the model cites no real message', async () => {
    const { service } = setup({
      partials: [
        {
          title: 'Invented',
          sections: [{ heading: 'H', markdown: 'B', sourceLabels: ['m99'] }],
          actionItems: [],
        },
      ],
    });

    await expect(
      finish(await service.draftFromThread(linh, 'root'))
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });
});
