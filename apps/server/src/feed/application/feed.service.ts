import {
  FEED_PAGE_DEFAULT,
  FEED_RANK_MAX,
  type FeedFilter,
  type FeedSource,
  type ModelUrgency,
  ModelUrgencySchema,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { AiAccessService } from '@/ai/application/ai-access.service';
import { aiError } from '@/ai/domain/ai-errors';
import { ModelPort, type PartialObject } from '@/ai/domain/model.port';
import { FeedRepository } from '@/feed/domain/feed.repository';
import { withExcerpt } from '@/feed/domain/feed-entry';
import { feedError } from '@/feed/domain/feed-errors';
import {
  buildUrgencyInput,
  ratedItems,
  URGENCY_MAX_OUTPUT_TOKENS,
  URGENCY_SYSTEM_PROMPT,
} from '@/feed/domain/urgency-prompt';

export type FeedViewer = { userId: string; organizationId: string };

/** The caller's own Activity. Every query is scoped to the caller, so no one reads or marks another member's items. */
@Injectable()
export class FeedService {
  constructor(
    @Inject(FeedRepository) private readonly feed: FeedRepository,
    @Inject(AiAccessService) private readonly access: AiAccessService,
    @Inject(ModelPort) private readonly model: ModelPort
  ) {}

  async list(
    viewer: FeedViewer,
    input: {
      filter: FeedFilter;
      sources?: FeedSource[];
      q?: string;
      before?: string;
      limit?: number;
    }
  ) {
    const page = await this.feed.list({
      userId: viewer.userId,
      organizationId: viewer.organizationId,
      filter: input.filter,
      sources: input.sources ?? [],
      q: input.q ?? '',
      before: input.before,
      limit: input.limit ?? FEED_PAGE_DEFAULT,
    });
    if (!page) {
      throw feedError('NOT_FOUND');
    }
    return { entries: page.entries.map(withExcerpt), hasMore: page.hasMore };
  }

  markRead(viewer: FeedViewer, ids: string[]) {
    return this.feed.markRead(viewer.userId, ids);
  }

  markUnread(viewer: FeedViewer, ids: string[]) {
    return this.feed.markUnread(viewer.userId, ids);
  }

  markAllRead(viewer: FeedViewer) {
    return this.feed.markAllRead(viewer.userId, viewer.organizationId);
  }

  /**
   * Has the model judge the caller's newest unread mentions and replies that have no urgency yet, up to
   * `FEED_RANK_MAX`, and stores what it says. With nothing to judge, it does not call the model.
   */
  async rank(viewer: FeedViewer, signal?: AbortSignal) {
    await this.access.assertEnabled(viewer.organizationId);
    const items = await this.feed.unranked({
      userId: viewer.userId,
      organizationId: viewer.organizationId,
      limit: FEED_RANK_MAX,
    });
    if (items.length === 0) return;

    const names = await this.feed.userNames([
      ...new Set([
        viewer.userId,
        ...items.flatMap((item) => [item.actorId, ...item.mentionedUserIds]),
      ]),
    ]);
    const input = buildUrgencyInput(
      names.get(viewer.userId) ?? 'the member',
      items,
      names
    );

    let last: PartialObject<ModelUrgency> | undefined;
    for await (const partial of this.model.streamObject({
      system: URGENCY_SYSTEM_PROMPT,
      prompt: input.prompt,
      schema: ModelUrgencySchema,
      maxOutputTokens: URGENCY_MAX_OUTPUT_TOKENS,
      signal,
    })) {
      last = partial;
    }

    const ratings = ratedItems(last, input.labels);
    if (ratings.length === 0) {
      throw aiError('AI_UNAVAILABLE');
    }
    await this.feed.setUrgency(viewer.userId, ratings);
  }
}
