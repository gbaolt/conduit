import { FEED_PAGE_DEFAULT, type FeedFilter } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { FeedRepository } from '@/feed/domain/feed.repository';
import { withExcerpt } from '@/feed/domain/feed-entry';
import { feedError } from '@/feed/domain/feed-errors';

export type FeedViewer = { userId: string; organizationId: string };

/** The caller's own Activity. Every query is scoped to the caller, so no one reads or marks another member's items. */
@Injectable()
export class FeedService {
  constructor(@Inject(FeedRepository) private readonly feed: FeedRepository) {}

  async list(
    viewer: FeedViewer,
    input: { filter: FeedFilter; before?: string; limit?: number }
  ) {
    const page = await this.feed.list({
      userId: viewer.userId,
      organizationId: viewer.organizationId,
      filter: input.filter,
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

  markAllRead(viewer: FeedViewer) {
    return this.feed.markAllRead(viewer.userId, viewer.organizationId);
  }
}
