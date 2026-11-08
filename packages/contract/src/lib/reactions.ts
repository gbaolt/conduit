import type { ReactionSummary } from '@/schemas/messages';

/** The most distinct emoji one message can carry. */
export const REACTION_EMOJI_MAX = 50;

/** `summary` with `userId` added under `emoji`, or null when that would pass the cap. */
export function addReaction(
  summary: ReactionSummary,
  emoji: string,
  userId: string
): ReactionSummary | null {
  const users = summary[emoji] ?? [];
  if (users.includes(userId)) return summary;
  if (
    !(emoji in summary) &&
    Object.keys(summary).length >= REACTION_EMOJI_MAX
  ) {
    return null;
  }
  return { ...summary, [emoji]: [...users, userId] };
}

/** `summary` without `userId` under `emoji`. An emoji nobody uses is dropped. */
export function removeReaction(
  summary: ReactionSummary,
  emoji: string,
  userId: string
): ReactionSummary {
  const users = summary[emoji];
  if (!users?.includes(userId)) return summary;

  const { [emoji]: _, ...rest } = summary;
  const remaining = users.filter((id) => id !== userId);
  return remaining.length > 0 ? { ...rest, [emoji]: remaining } : rest;
}
