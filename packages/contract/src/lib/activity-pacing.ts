/** How often each kind of activity may reach the database. The client and the write-rate script share these. */
export const TYPING_PING_INTERVAL_MS = 3000;
/** A typing row stays visible this long after the last ping. */
export const TYPING_TTL_MS = 5000;
export const DRAFT_DEBOUNCE_MS = 1000;
export const DRAFT_MIN_INTERVAL_MS = 5000;
export const READ_DEBOUNCE_MS = 1000;
export const READ_MIN_INTERVAL_MS = 5000;
export const HEARTBEAT_INTERVAL_MS = 60_000;
/** A member is online while their last heartbeat is younger than this and they are not away. */
export const ONLINE_WINDOW_MS = 120_000;

export type PresenceStatus = 'online' | 'away';

export function presenceStatus(
  row: { lastActiveAt: Date; away: boolean } | undefined,
  now: number
): PresenceStatus {
  return row && !row.away && now - row.lastActiveAt.getTime() < ONLINE_WINDOW_MS
    ? 'online'
    : 'away';
}

/** Typing rows still in force at `now`. */
export function activeTypers<T extends { until: Date }>(
  rows: readonly T[],
  now: number
) {
  return rows.filter((row) => row.until.getTime() > now);
}

/** Opens at most once per `intervalMs`: the first call opens, and calls inside the interval do not. */
export function createLeadingGate(intervalMs: number) {
  let openedAt = Number.NEGATIVE_INFINITY;

  return () => {
    const now = Date.now();
    if (now - openedAt < intervalMs) return false;
    openedAt = now;
    return true;
  };
}

/**
 * Writes the latest pushed value once `debounceMs` has passed with no new push, and never sooner than
 * `minIntervalMs` after the previous write, so a steady stream of pushes cannot become a steady stream of writes.
 */
export function createTrailingWriter<T>(
  write: (value: T) => void,
  { debounceMs, minIntervalMs }: { debounceMs: number; minIntervalMs: number }
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | undefined;
  let wroteAt = Number.NEGATIVE_INFINITY;

  const run = () => {
    timer = undefined;
    if (!pending) return;
    const { value } = pending;
    pending = undefined;
    wroteAt = Date.now();
    write(value);
  };

  return {
    push(value: T) {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(
        run,
        Math.max(debounceMs, wroteAt + minIntervalMs - Date.now())
      );
    },
    /** Writes a pending value now, such as when the composer closes. */
    flush() {
      clearTimeout(timer);
      run();
    },
  };
}

/**
 * What a composer does as the viewer types: saves the draft after a pause, and pings that they are typing
 * at most every 3 s. `saved` is the draft the composer started from, so loading it does not count as a change.
 * Call `flush` when the composer closes.
 */
export function createComposerActivity({
  saved,
  saveDraft,
  ping,
}: {
  saved: string;
  saveDraft: (body: string) => void;
  ping: () => void;
}) {
  let last = saved;
  const mayPing = createLeadingGate(TYPING_PING_INTERVAL_MS);
  const drafts = createTrailingWriter(saveDraft, {
    debounceMs: DRAFT_DEBOUNCE_MS,
    minIntervalMs: DRAFT_MIN_INTERVAL_MS,
  });

  return {
    change(markdown: string) {
      if (markdown === last) return;
      last = markdown;
      drafts.push(markdown);
      if (markdown.trim() && mayPing()) ping();
    },
    flush: drafts.flush,
  };
}
