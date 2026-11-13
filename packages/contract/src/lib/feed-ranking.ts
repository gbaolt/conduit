import type { ActivityUrgency, FeedEntry } from '@/schemas/feed';

/** Adds by one person fold into one group while they fall within this long of the group's newest add. */
export const FOLD_ADDS_WITHIN_MS = 60 * 60 * 1000;

/** Entries that read as one row: reactions to one message, or channel adds by one person. */
export type FeedGroup = {
  /** The id of the newest entry. */
  id: string;
  /** Newest first. A mention or a reply is a group of one. */
  entries: [FeedEntry, ...FeedEntry[]];
};

/** Entries with the same key fold together. Null never folds. */
function foldKey(entry: FeedEntry) {
  if (entry.kind === 'reaction' && entry.message) {
    return `reaction:${entry.message.id}`;
  }
  if (entry.kind === 'room_add') return `room-add:${entry.actor.id}`;
  return null;
}

/**
 * Folds entries, newest first, into groups in the order of their newest entry. It is a rule, so it
 * runs the same whether AI is on or off.
 */
export function foldFeed(entries: readonly FeedEntry[]): FeedGroup[] {
  const groups: FeedGroup[] = [];
  const open = new Map<string, FeedGroup>();

  for (const entry of entries) {
    const key = foldKey(entry);
    const group = key ? open.get(key) : undefined;
    const fits =
      group &&
      (entry.kind === 'reaction' ||
        group.entries[0].createdAt.getTime() - entry.createdAt.getTime() <=
          FOLD_ADDS_WITHIN_MS);

    if (group && fits) {
      group.entries.push(entry);
      continue;
    }
    const next: FeedGroup = { id: entry.id, entries: [entry] };
    groups.push(next);
    if (key) open.set(key, next);
  }
  return groups;
}

const TIER_ORDER: Record<ActivityUrgency, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};

/** Reactions and adds are always low. A mention or reply the model has not judged counts as normal. */
export function tierOf(entry: FeedEntry): ActivityUrgency {
  if (entry.kind === 'reaction' || entry.kind === 'room_add') return 'low';
  return entry.urgency ?? 'normal';
}

export const isGroupUnread = (group: FeedGroup) =>
  group.entries.some((entry) => !entry.readAt);

/** Unread before read. Within each, urgent, then normal, then low, then newest first. */
export function rankFeed(groups: readonly FeedGroup[]): FeedGroup[] {
  return [...groups].sort(
    (a, b) =>
      Number(!isGroupUnread(a)) - Number(!isGroupUnread(b)) ||
      TIER_ORDER[tierOf(a.entries[0])] - TIER_ORDER[tierOf(b.entries[0])] ||
      b.entries[0].createdAt.getTime() - a.entries[0].createdAt.getTime()
  );
}
