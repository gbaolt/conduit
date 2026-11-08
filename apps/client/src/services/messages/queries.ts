import type { ListMessagesOutput, Message } from '@conduit/contract';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

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

/** Pages of a thread's replies, shaped like the channel's pages. */
export const repliesQuery = (parentId: string) =>
  orpc.messages.listReplies.infiniteOptions({
    input: (before: string | undefined) => ({ messageId: parentId, before }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore ? last.messages.at(-1)?.id : undefined,
  });

/** The message that started a thread. The thread's stream keeps it current. */
export const threadRootQuery = (parentId: string) =>
  orpc.messages.get.queryOptions({ input: { messageId: parentId } });

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

/**
 * Writes a stored message into the lists that show it: the channel log when it belongs there, its thread
 * when it is a reply, and the open thread panel's root when it is the root.
 */
export function cacheMessage(queryClient: QueryClient, message: Message) {
  const upsert = (data: MessagePages | undefined) =>
    upsertMessages(data, [message]);

  if (!message.parentId || message.alsoSentToChannel) {
    queryClient.setQueryData(messagesQuery(message.channelId).queryKey, upsert);
  }
  if (message.parentId) {
    queryClient.setQueryData(repliesQuery(message.parentId).queryKey, upsert);
  } else {
    queryClient.setQueryData(threadRootQuery(message.id).queryKey, (root) =>
      root && message.updatedAt >= root.updatedAt ? message : root
    );
  }
}

/** Changes one message by id wherever it is cached: the channel log, every loaded thread, and a thread root. */
export function patchCachedMessage(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  change: (message: Message) => Message
) {
  const patch = (data: MessagePages | undefined) =>
    mapMessage(data, messageId, change);

  queryClient.setQueryData(messagesQuery(channelId).queryKey, patch);
  queryClient.setQueriesData<MessagePages>(
    { queryKey: orpc.messages.listReplies.key({ type: 'infinite' }) },
    patch
  );
  queryClient.setQueryData(
    threadRootQuery(messageId).queryKey,
    (root) => root && change(root)
  );
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
