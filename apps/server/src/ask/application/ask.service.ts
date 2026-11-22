import {
  type Answer,
  type AnswerSource,
  type AskChat,
  type AskChatSummary,
  type AskEvent,
  type AskGuideArticle,
  type ModelAnswer,
  ModelAnswerSchema,
} from '@conduit/contract';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { AiAccessService } from '@/ai/application/ai-access.service';
import { aiError } from '@/ai/domain/ai-errors';
import {
  type ModelImage,
  ModelPort,
  type ModelTools,
  type PartialObject,
} from '@/ai/domain/model.port';
import {
  AskAttachmentsService,
  type ReadAttachments,
} from '@/ask/application/ask-attachments.service';
import {
  type AnswerRef,
  AnswersRepository,
  type AnswerTarget,
  type StoredAnswer,
} from '@/ask/domain/answers.repository';
import { AskContextRepository } from '@/ask/domain/ask-context.repository';
import { askError } from '@/ask/domain/ask-errors';
import {
  ASK_CHAT_TURNS_MAX,
  ASK_CHATS_LIST_MAX,
  ASK_GUIDE_READS_MAX,
  ASK_MAX_OUTPUT_TOKENS,
  ASK_REWRITE_MAX_OUTPUT_TOKENS,
  ASK_REWRITE_PROMPT,
  ASK_SYSTEM_PROMPT,
  ASK_THREAD_REPLIES_MAX,
  ASK_TOOL_RESULTS_MAX,
  ASK_TOOL_STEPS_MAX,
  ASK_TOP_K,
  type AskHistory,
  askHistory,
  type AskInput,
  type AskPassage,
  buildAskInput,
  chatTitle,
  citeAnswer,
  draftId,
  mentionedUserIds,
  passageKey,
  sourceTag,
  standaloneQueryPrompt,
  StandaloneQuerySchema,
} from '@/ask/domain/ask-prompt';
import { guideArticle } from '@/ask/domain/guide/guide';
import {
  SearchService,
  type SearchViewer,
} from '@/search/application/search.service';

function toSource(passage: AskPassage): AnswerSource {
  switch (passage.type) {
    case 'message':
      return { type: 'message', message: passage.message };
    case 'file':
      return { type: 'file', file: passage.file };
    case 'channel': {
      const { id, name, topic } = passage.channel;
      return { type: 'channel', channel: { id, name, topic } };
    }
    case 'person': {
      const { id, name, image } = passage.person;
      return { type: 'person', person: { id, name, image } };
    }
    case 'draft':
      return { type: 'draft', draft: passage.draft };
    case 'guide': {
      const { slug, title } = passage.article;
      return { type: 'guide', article: { slug, title } };
    }
  }
}

/** Splits at the first colon only, because a draft's id holds a slash and could hold more. */
function refOf(key: string): AnswerRef {
  const at = key.indexOf(':');
  return {
    type: key.slice(0, at) as AnswerRef['type'],
    id: key.slice(at + 1),
  };
}

/** Keeps the entries whose text holds a word of `query`, or all of them when there is no query. */
function matching<T>(items: T[], text: (item: T) => string, query?: string) {
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items.slice(0, ASK_TOOL_RESULTS_MAX);
  return items
    .filter((item) => {
      const haystack = text(item).toLowerCase();
      return words.some((word) => haystack.includes(word));
    })
    .slice(0, ASK_TOOL_RESULTS_MAX);
}

/** How many saved items or drafts a tool call looks through before it filters them. */
const TOOL_SCAN_MAX = 100;

/** The body with its citations renumbered, and the sources it cites, from what the model wrote so far. */
function cited(model: PartialObject<ModelAnswer> | undefined, input: AskInput) {
  const found = model?.found !== false;
  const sources = new Map(
    input.sources.map((passage) => [passageKey(passage), toSource(passage)])
  );
  const answer = citeAnswer(
    found ? (model?.body ?? '') : '',
    input.sources.map(passageKey)
  );
  return {
    found,
    body: answer.body,
    keys: answer.cited,
    sources: answer.cited.map((key) => sources.get(key)!),
  };
}

/** A run of one question. `settled` resolves once the answer is stored or has failed, whether or not anyone still reads `events`. */
export type AskRun = {
  events: AsyncIterable<AskEvent>;
  settled: Promise<void>;
};

/** One question in a chat, the files it carries, and where its answer is stored. */
type Turn = {
  question: string;
  attachments: ReadAttachments['attachments'];
  images: ModelImage[];
  target: AnswerTarget;
};

/** Who asks, and the channels they may read. Every read for the answer goes through it. */
type AskScope = { organizationId: string; userId: string; roomIds: string[] };

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  constructor(
    @Inject(AiAccessService) private readonly access: AiAccessService,
    @Inject(ModelPort) private readonly model: ModelPort,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(AnswersRepository) private readonly answers: AnswersRepository,
    @Inject(AskContextRepository)
    private readonly context: AskContextRepository,
    @Inject(AskAttachmentsService)
    private readonly attachments: AskAttachmentsService
  ) {}

  /** The channels the asker can open. Never a DM, even one the asker is in. */
  private async scope(viewer: SearchViewer): Promise<AskScope> {
    return {
      organizationId: viewer.organizationId,
      userId: viewer.userId,
      roomIds: await this.context.channelIds(
        viewer.organizationId,
        viewer.userId
      ),
    };
  }

  /**
   * Answers from what the asker can read in channels, in a new chat or the asker's chat `chatId`. Everything that
   * can refuse happens before the stream starts, so a refusal is an ordinary error. The model reads the search
   * results, the chat's earlier turns, and what its read-only tools return, all through `AskScope`.
   */
  async question(
    viewer: SearchViewer,
    {
      chatId,
      question,
      attachmentIds = [],
    }: { chatId?: string; question: string; attachmentIds?: string[] }
  ): Promise<AskRun> {
    await this.access.assertEnabled(viewer.organizationId);

    let history: AskHistory = [];
    let target: AnswerTarget;
    if (chatId) {
      const chat = await this.ownChat(viewer, chatId);
      if (chat.answers.length >= ASK_CHAT_TURNS_MAX) {
        throw askError('CHAT_FULL');
      }
      history = askHistory(chat.answers);
      target = { chatId };
    } else {
      target = {
        newChat: {
          organizationId: viewer.organizationId,
          ownerId: viewer.userId,
          title: chatTitle(question),
        },
      };
    }
    const read = await this.attachments.read(viewer, attachmentIds);
    const turn: Turn = {
      question,
      attachments: read.attachments,
      images: read.images,
      target,
    };

    const scope = await this.scope(viewer);
    let passages: AskPassage[];
    try {
      passages = await this.search.passages(
        scope.organizationId,
        scope.roomIds,
        await this.searchQuery(question, history),
        ASK_TOP_K
      );
    } catch (error) {
      this.logger.warn(
        `Search index query failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw aiError('AI_UNAVAILABLE');
    }
    const names = await this.answers.userNames(mentionedUserIds(passages));
    const input = buildAskInput(
      question,
      passages,
      names,
      history,
      read.inputs
    );
    return this.run(turn, input, this.tools(scope, input, names));
  }

  /**
   * The read-only tools the model may call. Each result joins `input.sources`, numbered after the sources already
   * there, so the model cites it like the rest. Everything they read is inside `scope`.
   */
  private tools(
    scope: AskScope,
    input: AskInput,
    names: Map<string, string>
  ): ModelTools {
    const add = async (found: AskPassage[]) => {
      const unnamed = mentionedUserIds(found).filter((id) => !names.has(id));
      for (const [id, name] of await this.answers.userNames(unnamed)) {
        names.set(id, name);
      }
      const tags: string[] = [];
      for (const passage of found) {
        const key = passageKey(passage);
        const known = input.sources.findIndex((s) => passageKey(s) === key);
        const n = known === -1 ? input.sources.length + 1 : known + 1;
        const tag = sourceTag(n, passage, names);
        if (!tag) continue;
        if (known === -1) input.sources.push(passage);
        tags.push(tag);
      }
      return tags.length > 0 ? tags.join('\n') : 'Nothing found.';
    };
    const { organizationId, userId, roomIds } = scope;

    return {
      search: {
        description:
          'Search the messages and files in channels the asker can read, with other words than the question.',
        input: z.object({ query: z.string().describe('What to search for.') }),
        execute: async ({ query }: { query: string }) =>
          add(
            await this.search.passages(
              organizationId,
              roomIds,
              query,
              ASK_TOOL_RESULTS_MAX
            )
          ),
      },
      thread: {
        description:
          'Read the whole thread that a message source is in: its first message and the replies.',
        input: z.object({
          source: z.number().int().describe('The n of a message source.'),
        }),
        execute: async ({ source }: { source: number }) => {
          const passage = input.sources[source - 1];
          let messageId: string | null = null;
          if (passage?.type === 'message') messageId = passage.message.id;
          if (passage?.type === 'file') messageId = passage.file.messageId;
          if (!messageId) return 'That source is not a message.';
          const messages = await this.context.thread(
            roomIds,
            messageId,
            ASK_THREAD_REPLIES_MAX
          );
          return add(messages.map((message) => ({ type: 'message', message })));
        },
      },
      channel: {
        description:
          'Look up channels by name: topic, description, and who is in each, managers marked.',
        input: z.object({
          name: z.string().describe('The channel name, or part of it.'),
        }),
        execute: async ({ name }: { name: string }) =>
          add(
            (await this.context.channels(roomIds, name, 5)).map((channel) => ({
              type: 'channel',
              channel,
            }))
          ),
      },
      people: {
        description:
          'Find workspace members by name, with their role in the workspace.',
        input: z.object({
          name: z.string().describe('The name, or part of it.'),
        }),
        execute: async ({ name }: { name: string }) =>
          add(
            (
              await this.context.people(
                organizationId,
                name,
                ASK_TOOL_RESULTS_MAX
              )
            ).map((person) => ({ type: 'person', person }))
          ),
      },
      saved: {
        description:
          "The asker's own saved messages, newest saved first, optionally only those holding a word of query.",
        input: z.object({ query: z.string().optional() }),
        execute: async ({ query }: { query?: string }) => {
          const saved = await this.context.saved(
            userId,
            roomIds,
            TOOL_SCAN_MAX
          );
          return add(
            matching(saved, (message) => message.body, query).map(
              (message) => ({ type: 'message', message })
            )
          );
        },
      },
      guide: {
        description:
          'Read articles of the Conduit guide, which explains the Conduit app itself, by their slugs.',
        input: z.object({
          slugs: z
            .array(z.string())
            .min(1)
            .max(ASK_GUIDE_READS_MAX)
            .describe('Slugs from the list of guide articles.'),
        }),
        execute: async ({ slugs }: { slugs: string[] }) => {
          const articles = slugs.flatMap((slug) => {
            const article = guideArticle(slug);
            return article ? [article] : [];
          });
          return add(articles.map((article) => ({ type: 'guide', article })));
        },
      },
      drafts: {
        description:
          "The asker's own unsent drafts, newest first, optionally only those holding a word of query.",
        input: z.object({ query: z.string().optional() }),
        execute: async ({ query }: { query?: string }) => {
          const drafts = await this.context.drafts(
            userId,
            roomIds,
            TOOL_SCAN_MAX
          );
          return add(
            matching(drafts, (draft) => draft.body, query).map((draft) => ({
              type: 'draft',
              draft,
            }))
          );
        },
      },
    };
  }

  /** The asker's newest chats in this workspace. */
  async chats(viewer: SearchViewer): Promise<AskChatSummary[]> {
    await this.access.assertEnabled(viewer.organizationId);
    const chats = await this.answers.listChats(
      viewer.organizationId,
      viewer.userId,
      ASK_CHATS_LIST_MAX
    );
    return chats.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  }

  /** The asker's own chat, every answer's sources read again through their access now. */
  async chat(viewer: SearchViewer, chatId: string): Promise<AskChat> {
    await this.access.assertEnabled(viewer.organizationId);
    const chat = await this.ownChat(viewer, chatId);
    return {
      id: chat.id,
      title: chat.title,
      answers: await this.hydrate(await this.scope(viewer), chat.answers),
    };
  }

  /** An article of the Conduit guide, for the panel a cited article opens in. */
  async guide(viewer: SearchViewer, slug: string): Promise<AskGuideArticle> {
    await this.access.assertEnabled(viewer.organizationId);
    const article = guideArticle(slug);
    if (!article) throw askError('ARTICLE_NOT_FOUND');
    return { slug: article.slug, title: article.title, body: article.body };
  }

  async deleteChat(viewer: SearchViewer, chatId: string) {
    await this.ownChat(viewer, chatId);
    await this.answers.deleteChat(chatId);
  }

  /** A chat that isn't the viewer's, in this workspace, reads as missing, so its existence never shows. */
  private async ownChat(viewer: SearchViewer, chatId: string) {
    const chat = await this.answers.findChat(chatId);
    if (
      !chat ||
      chat.organizationId !== viewer.organizationId ||
      chat.ownerId !== viewer.userId
    ) {
      throw askError('NOT_FOUND');
    }
    return chat;
  }

  /**
   * A follow-up such as "and for Pro?" matches nothing on its own words, so the model first writes a query that
   * stands alone. When that fails, the search reads the last question and this one together.
   */
  private async searchQuery(question: string, history: AskHistory) {
    if (history.length === 0) return question;
    try {
      let last: unknown;
      for await (const partial of this.model.streamObject({
        system: ASK_REWRITE_PROMPT,
        prompt: standaloneQueryPrompt(history, question),
        schema: StandaloneQuerySchema,
        maxOutputTokens: ASK_REWRITE_MAX_OUTPUT_TOKENS,
      })) {
        last = partial;
      }
      const query = StandaloneQuerySchema.safeParse(last).data?.query.trim();
      if (query) return query;
    } catch (error) {
      this.logger.warn(
        `Follow-up query rewrite failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return `${history.at(-1)!.question} ${question}`;
  }

  /** Every answer's sources, read in one pass through the asker's scope now, and renumbered without the gone. */
  private async hydrate(
    scope: AskScope,
    stored: readonly StoredAnswer[]
  ): Promise<Answer[]> {
    const idsOf = (type: AnswerRef['type']) => [
      ...new Set(
        stored.flatMap((answer) =>
          answer.sources.filter((ref) => ref.type === type).map((ref) => ref.id)
        )
      ),
    ];
    const draftIds = new Set(idsOf('draft'));
    const [{ messages, files }, channels, people, drafts] = await Promise.all([
      this.search.readable(scope.organizationId, scope.roomIds, {
        messageIds: idsOf('message'),
        fileIds: idsOf('file'),
      }),
      this.context.channelsById(scope.roomIds, idsOf('channel')),
      this.context.peopleById(scope.organizationId, idsOf('person')),
      draftIds.size > 0
        ? this.context.drafts(scope.userId, scope.roomIds, TOOL_SCAN_MAX)
        : [],
    ]);
    const readable = new Map<string, AnswerSource>([
      ...channels.map(
        (channel) =>
          [`channel:${channel.id}`, { type: 'channel', channel }] as const
      ),
      ...people.map(
        (person) => [`person:${person.id}`, { type: 'person', person }] as const
      ),
      ...drafts
        .filter((draft) => draftIds.has(draftId(draft)))
        .map(
          (draft) =>
            [`draft:${draftId(draft)}`, { type: 'draft', draft }] as const
        ),
      ...messages.map(
        (message) =>
          [`message:${message.id}`, { type: 'message', message }] as const
      ),
      ...files.map(
        (file) => [`file:${file.id}`, { type: 'file', file }] as const
      ),
      ...idsOf('guide').flatMap((slug) => {
        const article = guideArticle(slug);
        return article
          ? [
              [
                `guide:${slug}`,
                {
                  type: 'guide',
                  article: { slug, title: article.title },
                },
              ] as const,
            ]
          : [];
      }),
    ]);
    return Promise.all(
      stored.map(async (answer) => {
        const { body, cited: keys } = citeAnswer(
          answer.body,
          answer.sources.map((ref) => {
            const key = `${ref.type}:${ref.id}`;
            return readable.has(key) ? key : null;
          })
        );
        return {
          id: answer.id,
          chatId: answer.chatId,
          question: answer.question,
          found: answer.found,
          body,
          sources: keys.map((key) => readable.get(key)!),
          attachments: await Promise.all(
            answer.attachments.map((attachment) =>
              this.attachments.view(attachment)
            )
          ),
          createdAt: answer.createdAt,
        };
      })
    );
  }

  /**
   * Runs the model on its own promise, apart from the reader. Fluid Compute cancels a request whose client
   * leaves, so the caller hands `settled` to `waitUntil` and a reader who leaves still gets an answer stored.
   */
  private run(turn: Turn, input: AskInput, tools: ModelTools): AskRun {
    let latest: PartialObject<ModelAnswer> | undefined;
    let outcome: { answer: Answer } | { error: unknown } | undefined;
    let wake = () => {};
    let woken = new Promise<void>((resolve) => (wake = resolve));

    const settled = this.generate(turn, input, tools, (partial) => {
      latest = partial;
      wake();
    })
      .then(
        (answer) => {
          outcome = { answer };
        },
        (error: unknown) => {
          outcome = { error };
        }
      )
      .finally(() => wake());

    async function* events(): AsyncGenerator<AskEvent> {
      let shown = '';
      while (true) {
        await woken;
        woken = new Promise<void>((resolve) => (wake = resolve));
        if (outcome) {
          if ('error' in outcome) throw outcome.error;
          yield { type: 'done', answer: outcome.answer };
          return;
        }
        const { found, body, sources } = cited(latest, input);
        const key = JSON.stringify([found, body]);
        if (key === shown) continue;
        shown = key;
        yield { type: 'partial', found, body, sources };
      }
    }

    return { events: events(), settled };
  }

  private async generate(
    turn: Turn,
    input: AskInput,
    tools: ModelTools,
    onPartial: (partial: PartialObject<ModelAnswer>) => void
  ) {
    let last: PartialObject<ModelAnswer> | undefined;
    for await (const partial of this.model.streamObject({
      system: ASK_SYSTEM_PROMPT,
      prompt: input.prompt,
      images: turn.images,
      schema: ModelAnswerSchema,
      maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
      tools,
      maxToolSteps: ASK_TOOL_STEPS_MAX,
    })) {
      last = partial;
      onPartial(partial);
    }
    const parsed = ModelAnswerSchema.safeParse(last);
    if (!parsed.success) throw aiError('AI_UNAVAILABLE');
    return this.store(turn, input, parsed.data);
  }

  private async store(
    turn: Turn,
    input: AskInput,
    model: ModelAnswer
  ): Promise<Answer> {
    const answer = cited(model, input);
    // An answer that cites nothing it read is not an answer from the sources, unless it read the attachments.
    const found =
      answer.found &&
      answer.body.trim() !== '' &&
      (answer.keys.length > 0 || turn.attachments.length > 0);
    const stored = await this.answers.addAnswer(turn.target, {
      question: turn.question,
      found,
      body: found ? answer.body : '',
      sources: found ? answer.keys.map(refOf) : [],
      attachmentIds: turn.attachments.map((attachment) => attachment.id),
    });
    return {
      id: stored.id,
      chatId: stored.chatId,
      question: turn.question,
      found,
      body: stored.body,
      sources: found ? answer.sources : [],
      attachments: await Promise.all(
        stored.attachments.map((attachment) =>
          this.attachments.view(attachment)
        )
      ),
      createdAt: stored.createdAt,
    };
  }
}
