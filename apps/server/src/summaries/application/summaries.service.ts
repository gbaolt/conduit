import {
  citedSourceIds,
  type ModelSummary,
  ModelSummarySchema,
  type Summary,
  type SummaryEvent,
  SummarySchema,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { AiAccessService } from '@/ai/application/ai-access.service';
import { aiError } from '@/ai/domain/ai-errors';
import { ModelPort, type PartialObject } from '@/ai/domain/model.port';
import {
  MessagesService,
  type MessageViewer,
} from '@/messages/application/messages.service';
import {
  type StoredSummary,
  SummariesRepository,
} from '@/summaries/domain/summaries.repository';
import { citedBullets } from '@/summaries/domain/summary-citations';
import { summaryError } from '@/summaries/domain/summary-errors';
import {
  buildSummaryInput,
  SUMMARY_MAX_OUTPUT_TOKENS,
  SUMMARY_SYSTEM_PROMPT,
  type SummaryInput,
} from '@/summaries/domain/summary-prompt';
import { summaryMessageBody } from '@/summaries/domain/summary-share';

type Scope = { channelId: string; parentId: string | null; from: Date | null };

/** What the API returns: the summary without the fields that decide who may read it. */
function toSummary(stored: StoredSummary): Summary {
  return SummarySchema.parse(stored);
}

@Injectable()
export class SummariesService {
  constructor(
    @Inject(AiAccessService) private readonly access: AiAccessService,
    @Inject(ModelPort) private readonly model: ModelPort,
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(SummariesRepository)
    private readonly summaries: SummariesRepository
  ) {}

  /**
   * Summarizes a thread. Everything that can refuse happens here, before the stream starts, so a refusal is an
   * ordinary error and not a broken stream.
   */
  async summarizeThread(
    viewer: MessageViewer,
    messageId: string,
    signal?: AbortSignal
  ) {
    await this.access.assertEnabled(viewer.organizationId);
    const root = await this.messages.get(viewer, messageId);
    if (root.parentId) {
      throw summaryError('NOT_FOUND');
    }

    const messages = await this.messages.listForSummary(viewer, {
      channelId: root.channelId,
      threadId: root.id,
    });
    return this.start(
      viewer,
      { channelId: root.channelId, parentId: root.id, from: null },
      messages,
      signal
    );
  }

  /** Summarizes the channel's log, or a DM's, from `from` until now. */
  async summarizeChannel(
    viewer: MessageViewer,
    input: { channelId: string; from: string },
    signal?: AbortSignal
  ) {
    await this.access.assertEnabled(viewer.organizationId);
    const from = new Date(input.from);

    const messages = await this.messages.listForSummary(viewer, {
      channelId: input.channelId,
      from,
    });
    return this.start(
      viewer,
      { channelId: input.channelId, parentId: null, from },
      messages,
      signal
    );
  }

  /** The requester's own summary. Anyone else reads it only after it was shared. */
  async get(viewer: MessageViewer, summaryId: string) {
    await this.access.assertEnabled(viewer.organizationId);
    const stored = await this.readable(viewer, summaryId);
    if (stored.requesterId !== viewer.userId && !stored.sharedMessageId) {
      throw summaryError('NOT_FOUND');
    }
    return toSummary(stored);
  }

  /** Posts the summary as a message from its requester, once. A retry returns the first share. */
  async share(viewer: MessageViewer, summaryId: string) {
    await this.access.assertEnabled(viewer.organizationId);
    const stored = await this.readable(viewer, summaryId);
    if (stored.requesterId !== viewer.userId) {
      throw summaryError('NOT_FOUND');
    }
    if (stored.sharedMessageId) {
      return toSummary(stored);
    }

    const channel = await this.messages.find(viewer, stored.channelId);
    const path = `${channel.kind === 'dm' ? '/dms' : '/channels'}/${channel.id}`;
    const { message } = await this.messages.send(viewer, {
      channelId: stored.channelId,
      clientId: `summary-${stored.id}`,
      body: summaryMessageBody(toSummary(stored), path),
      parentId: stored.parentId ?? undefined,
    });
    return toSummary(await this.summaries.setShared(stored.id, message.id));
  }

  /** The summary, when it is in the viewer's workspace and its channel is still readable by the viewer. */
  private async readable(viewer: MessageViewer, summaryId: string) {
    const stored = await this.summaries.find(summaryId);
    if (!stored || stored.organizationId !== viewer.organizationId) {
      throw summaryError('NOT_FOUND');
    }
    await this.messages.find(viewer, stored.channelId);
    return stored;
  }

  private async start(
    viewer: MessageViewer,
    scope: Scope,
    messages: Awaited<ReturnType<MessagesService['listForSummary']>>,
    signal?: AbortSignal
  ) {
    const names = await this.summaries.userNames([
      ...new Set(
        messages.flatMap((message) => [
          message.authorId,
          ...message.mentionedUserIds,
        ])
      ),
    ]);
    const input = buildSummaryInput(messages, names);
    if (input.messageCount === 0) {
      throw summaryError('NOTHING_TO_SUMMARIZE');
    }
    return this.stream(viewer, scope, input, signal);
  }

  private async *stream(
    viewer: MessageViewer,
    scope: Scope,
    input: SummaryInput,
    signal?: AbortSignal
  ): AsyncGenerator<SummaryEvent> {
    let last: PartialObject<ModelSummary> | undefined;
    let shown = '';

    for await (const partial of this.model.streamObject({
      system: SUMMARY_SYSTEM_PROMPT,
      prompt: input.prompt,
      schema: ModelSummarySchema,
      maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      signal,
    })) {
      last = partial;
      const bullets = citedBullets(partial, input.labels);
      const key = JSON.stringify(bullets);
      if (key !== shown) {
        shown = key;
        yield { type: 'partial', messageCount: input.messageCount, bullets };
      }
    }

    const bullets = citedBullets(last, input.labels);
    if (bullets.length === 0) {
      throw aiError('AI_UNAVAILABLE');
    }

    const stored = await this.summaries.create({
      organizationId: viewer.organizationId,
      requesterId: viewer.userId,
      channelId: scope.channelId,
      parentId: scope.parentId,
      from: scope.from,
      to: new Date(),
      messageCount: input.messageCount,
      bullets,
      sourceMessageIds: citedSourceIds(bullets),
    });
    yield { type: 'done', summary: toSummary(stored) };
  }
}
