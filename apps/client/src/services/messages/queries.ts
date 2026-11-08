import type { ListMessagesOutput, Message } from '@conduit/contract';
import type { InfiniteData } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc';

export type MessagePages = InfiniteData<ListMessagesOutput, string | undefined>;

/** Pages of top-level messages. Page 0 holds the newest, and each page is newest first. */
export const messagesQuery = (channelId: string) =>
  orpc.messages.list.infiniteOptions({
    input: (before: string | undefined) => ({ channelId, before }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore ? last.messages.at(-1)?.id : undefined,
  });

/** Oldest first, ties broken by id: the order the server pages in, reversed. */
export function compareMessages(a: Message, b: Message) {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** A deleted message stays only while replies hang from it. */
export function isVisible(message: Message) {
  return !message.deletedAt || message.replyCount > 0;
}

/** The loaded messages, oldest first. */
export function flattenMessages(data: MessagePages | undefined) {
  return (data?.pages ?? [])
    .flatMap((page) => page.messages)
    .filter(isVisible)
    .sort(compareMessages);
}

/**
 * Merges changed messages into the loaded pages. A known message is replaced unless the cache holds a newer version.
 * An unknown one joins the newest page, unless it is older than every loaded message while older pages remain:
 * the next page load brings it in.
 */
export function upsertMessages(
  data: MessagePages | undefined,
  incoming: readonly Message[]
): MessagePages | undefined {
  const first = data?.pages[0];
  if (!data || !first) return data;

  const known = new Map<string, Message>();
  for (const page of data.pages) {
    for (const message of page.messages) known.set(message.id, message);
  }
  const oldestPage = data.pages.at(-1);
  const oldestLoaded = oldestPage?.messages.at(-1);
  const hasOlder = Boolean(oldestPage?.hasMore);

  const replaced = new Map<string, Message>();
  const added: Message[] = [];
  for (const message of incoming) {
    const existing = replaced.get(message.id) ?? known.get(message.id);
    if (existing) {
      if (message.updatedAt >= existing.updatedAt) {
        replaced.set(message.id, message);
      }
    } else if (
      !hasOlder ||
      !oldestLoaded ||
      compareMessages(message, oldestLoaded) >= 0
    ) {
      added.push(message);
      known.set(message.id, message);
    }
  }
  if (replaced.size === 0 && added.length === 0) return data;

  const pages = data.pages.map((page, index) => {
    const messages = page.messages.map((m) => replaced.get(m.id) ?? m);
    if (index !== 0) return { ...page, messages };
    return {
      ...page,
      messages: [...added, ...messages].sort((a, b) => compareMessages(b, a)),
    };
  });
  return { ...data, pages };
}

/** Clears a deleted message locally, ahead of the live row that confirms it. */
export function markDeleted(
  data: MessagePages | undefined,
  messageId: string,
  at: Date
): MessagePages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId
          ? { ...message, body: '', deletedAt: at }
          : message
      ),
    })),
  };
}

/** Message pages with one message changed. */
export function mapMessage(
  data: MessagePages | undefined,
  messageId: string,
  change: (message: Message) => Message
): MessagePages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId ? change(message) : message
      ),
    })),
  };
}

export const pinnedQuery = (channelId: string) =>
  orpc.messages.listPinned.queryOptions({ input: { channelId } });

export const savedQuery = orpc.saved.list.queryOptions();

/**
 * True when a changed message means the pinned list no longer matches: a message pinned that the list
 * lacks, or one in the list that was unpinned or changed since. The list is not a live stream.
 */
export function pinnedIsStale(
  pinned: readonly Message[] | undefined,
  incoming: readonly Message[]
) {
  if (!pinned) return false;
  const known = new Map(pinned.map((message) => [message.id, message]));
  return incoming.some((message) => {
    const listed = known.get(message.id);
    if (listed) return message.updatedAt > listed.updatedAt;
    return Boolean(message.pinnedAt) && !message.deletedAt;
  });
}
