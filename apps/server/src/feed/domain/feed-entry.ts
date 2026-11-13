import {
  FEED_DELETED_BODY,
  FEED_EXCERPT_MAX,
  type FeedEntry,
} from '@conduit/contract';

/** What an entry shows of its message: the stored Markdown cut to the excerpt length, or the deleted notice. */
export function withExcerpt(entry: FeedEntry): FeedEntry {
  const { message } = entry;
  if (!message) return entry;

  return {
    ...entry,
    message: {
      ...message,
      body: message.deletedAt
        ? FEED_DELETED_BODY
        : [...message.body].slice(0, FEED_EXCERPT_MAX).join(''),
    },
  };
}
