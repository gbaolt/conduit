import {
  type Answer,
  type AnswerSource,
  type AskChat,
  type AskChatSummary,
  type AskEvent,
  type ModelAnswer,
  ModelAnswerSchema,
} from '@conduit/contract';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { AiAccessService } from '@/ai/application/ai-access.service';
import { aiError } from '@/ai/domain/ai-errors';
import { ModelPort, type PartialObject } from '@/ai/domain/model.port';
import {
  AnswersRepository,
  type AnswerTarget,
  type StoredAnswer,
} from '@/ask/domain/answers.repository';
import { askError } from '@/ask/domain/ask-errors';
import {
  ASK_CHAT_TURNS_MAX,
  ASK_CHATS_LIST_MAX,
  ASK_MAX_OUTPUT_TOKENS,
  ASK_REWRITE_MAX_OUTPUT_TOKENS,
  ASK_REWRITE_PROMPT,
  ASK_SYSTEM_PROMPT,
  ASK_TOP_K,
  type AskHistory,
  askHistory,
  type AskInput,
  buildAskInput,
  chatTitle,
  citeAnswer,
  mentionedUserIds,
  passageKey,
  standaloneQueryPrompt,
  StandaloneQuerySchema,
} from '@/ask/domain/ask-prompt';
import {
  SearchService,
  type SearchViewer,
} from '@/search/application/search.service';
import type { Passage } from '@/search/domain/search.repository';

const toSource = (passage: Passage): AnswerSource =>
  passage.type === 'message'
    ? { type: 'message', message: passage.message }
    : { type: 'file', file: passage.file };

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

/** One question in a chat, and where its answer is stored. */
type Turn = { question: string; target: AnswerTarget };

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  constructor(
    @Inject(AiAccessService) private readonly access: AiAccessService,
    @Inject(ModelPort) private readonly model: ModelPort,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(AnswersRepository) private readonly answers: AnswersRepository
  ) {}

  /**
   * Answers from the messages and file chunks the asker can read, in a new chat or the asker's chat `chatId`.
   * Everything that can refuse happens before the stream starts, so a refusal is an ordinary error. The model
   * reads only what `SearchService` passed, and the chat's earlier turns.
   */
  async question(
    viewer: SearchViewer,
    { chatId, question }: { chatId?: string; question: string }
  ): Promise<AskRun> {
    await this.access.assertEnabled(viewer.organizationId);

    let history: AskHistory = [];
    let turn: Turn;
    if (chatId) {
      const chat = await this.ownChat(viewer, chatId);
      if (chat.answers.length >= ASK_CHAT_TURNS_MAX) {
        throw askError('CHAT_FULL');
      }
      history = askHistory(chat.answers);
      turn = { question, target: { chatId } };
    } else {
      turn = {
        question,
        target: {
          newChat: {
            organizationId: viewer.organizationId,
            ownerId: viewer.userId,
            title: chatTitle(question),
          },
        },
      };
    }

    let passages: Passage[];
    try {
      passages = await this.search.passages(
        viewer,
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
    const input = buildAskInput(question, passages, names, history);

    if (input.sources.length === 0) {
      const answer = await this.store(turn, input, { found: false, body: '' });
      return {
        events: (async function* () {
          yield { type: 'done', answer } satisfies AskEvent;
        })(),
        settled: Promise.resolve(),
      };
    }
    return this.run(turn, input);
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
      answers: await this.hydrate(viewer, chat.answers),
    };
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

  /** Every answer's sources, read in one pass through the viewer's access now, and renumbered without the gone. */
  private async hydrate(
    viewer: SearchViewer,
    stored: readonly StoredAnswer[]
  ): Promise<Answer[]> {
    const idsOf = (type: 'message' | 'file') => [
      ...new Set(
        stored.flatMap((answer) =>
          answer.sources.filter((ref) => ref.type === type).map((ref) => ref.id)
        )
      ),
    ];
    const { messages, files } = await this.search.readable(viewer, {
      messageIds: idsOf('message'),
      fileIds: idsOf('file'),
    });
    const readable = new Map<string, AnswerSource>([
      ...messages.map(
        (message) =>
          [`message:${message.id}`, { type: 'message', message }] as const
      ),
      ...files.map(
        (file) => [`file:${file.id}`, { type: 'file', file }] as const
      ),
    ]);
    return stored.map((answer) => {
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
        createdAt: answer.createdAt,
      };
    });
  }

  /**
   * Runs the model on its own promise, apart from the reader. Fluid Compute cancels a request whose client
   * leaves, so the caller hands `settled` to `waitUntil` and a reader who leaves still gets an answer stored.
   */
  private run(turn: Turn, input: AskInput): AskRun {
    let latest: PartialObject<ModelAnswer> | undefined;
    let outcome: { answer: Answer } | { error: unknown } | undefined;
    let wake = () => {};
    let woken = new Promise<void>((resolve) => (wake = resolve));

    const settled = this.generate(turn, input, (partial) => {
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
    onPartial: (partial: PartialObject<ModelAnswer>) => void
  ) {
    let last: PartialObject<ModelAnswer> | undefined;
    for await (const partial of this.model.streamObject({
      system: ASK_SYSTEM_PROMPT,
      prompt: input.prompt,
      schema: ModelAnswerSchema,
      maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
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
    // An answer that cites nothing it read is not an answer from the sources.
    const found =
      answer.found && answer.body.trim() !== '' && answer.keys.length > 0;
    const stored = await this.answers.addAnswer(turn.target, {
      question: turn.question,
      found,
      body: found ? answer.body : '',
      sources: found
        ? answer.keys.map((key) => {
            const [type, id] = key.split(':') as ['message' | 'file', string];
            return { type, id };
          })
        : [],
    });
    return {
      id: stored.id,
      chatId: stored.chatId,
      question: turn.question,
      found,
      body: stored.body,
      sources: found ? answer.sources : [],
      createdAt: stored.createdAt,
    };
  }
}
