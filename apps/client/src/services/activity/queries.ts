import type { PresenceRow, SidebarEntry } from '@conduit/contract';
import { queryOptions, skipToken } from '@tanstack/react-query';

/**
 * The `sidebar` stream's rows, one per conversation the viewer belongs to. Keyed by `channelId`, so a DM
 * reads the same way as a channel. Only the stream writes it, so there is no fetch.
 */
export const sidebarStateQuery = queryOptions<SidebarEntry[]>({
  queryKey: ['live', 'sidebar'],
  queryFn: skipToken,
  staleTime: Infinity,
});

/** The `presence` stream's rows, one per member who has ever sent a heartbeat. */
export const presenceQuery = queryOptions<PresenceRow[]>({
  queryKey: ['live', 'presence'],
  queryFn: skipToken,
  staleTime: Infinity,
});

/** A conversation is unread when something was sent after the viewer last read it, or after they joined. */
export function isUnread(entry: SidebarEntry | undefined) {
  if (!entry?.lastMessageAt) return false;
  return entry.lastMessageAt > (entry.lastReadAt ?? entry.joinedAt);
}
