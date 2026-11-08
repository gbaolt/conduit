import type { Message } from '@conduit/contract';

/**
 * The message the New marker sits above: the first one from someone else after `readThrough`.
 * Null when there is none, or when older pages remain and the first unread one may be among them,
 * since a marker above the oldest loaded message would claim more than is known.
 */
export function firstUnreadId(
  messages: readonly Message[],
  readThrough: Date,
  viewerId: string | null,
  hasOlder: boolean
) {
  const index = messages.findIndex(
    (message) =>
      message.createdAt > readThrough &&
      message.authorId !== viewerId &&
      !message.deletedAt
  );
  if (index < 0 || (index === 0 && hasOlder)) return null;
  return messages[index]?.id ?? null;
}
