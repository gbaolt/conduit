import type { FeedEntry } from '@conduit/contract';
import type { Route } from 'next';

/**
 * Where an entry opens: the message in its conversation, or in its thread panel for a reply, with the
 * same `?thread=` link the Saved page uses. `?message=` scrolls to the message. A channel add opens the channel.
 */
export function feedEntryHref(entry: FeedEntry): Route {
  const base = `${entry.room.kind === 'dm' ? '/dms' : '/channels'}/${entry.room.id}`;
  const { message } = entry;
  if (!message) return base as Route;

  const params = new URLSearchParams();
  if (message.parentId) params.set('thread', message.parentId);
  params.set('message', message.id);
  return `${base}?${params}` as Route;
}
