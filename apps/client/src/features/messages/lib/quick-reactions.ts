/** The three emoji the message toolbar offers as one-click reactions, in slot order. */
export type QuickReactions = readonly [string, string, string];

export const DEFAULT_QUICK_REACTIONS: QuickReactions = ['👍', '❤️', '😂'];

/** The stored JSON, or the defaults when it is missing or not three emoji. */
export function parseQuickReactions(raw: string | null): QuickReactions {
  try {
    const stored: unknown = JSON.parse(raw ?? '');
    if (
      Array.isArray(stored) &&
      stored.length === 3 &&
      stored.every((emoji) => typeof emoji === 'string' && emoji.length > 0)
    ) {
      return stored as unknown as QuickReactions;
    }
  } catch {
    // Unreadable JSON falls back to the defaults.
  }
  return DEFAULT_QUICK_REACTIONS;
}

/** Puts `emoji` in `slot`. An emoji already in another slot trades places, so the three stay distinct. */
export function replaceQuickReaction(
  current: QuickReactions,
  slot: number,
  emoji: string
): QuickReactions {
  const from = current.indexOf(emoji);
  const previous = current[slot];
  const next = [...current] as [string, string, string];
  if (from !== -1 && previous) next[from] = previous;
  next[slot] = emoji;
  return next;
}
