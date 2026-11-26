import { parseAsString } from 'nuqs';

/** `?tab=` holds `messages` or a canvas id. Messages is the default, so it leaves the URL clean. */
export const roomTabParam = parseAsString.withDefault('messages');

/** What the room's canvas list is while the tab is chosen. */
export type RoomCanvasIds = readonly string[] | 'pending' | 'failed';

/**
 * The tab `?tab=` opens: `messages`, a canvas id, or null while the canvases load. `canvas`, from links made when
 * a room had one canvas, opens the first one. An id the loaded list lacks, such as a deleted canvas, falls back
 * to Messages. When the list failed, an id is still opened, so its own view shows why it cannot load.
 */
export function resolveRoomTab(
  tab: string,
  canvases: RoomCanvasIds
): string | null {
  if (tab === 'messages') return tab;
  if (canvases === 'pending') return null;
  if (canvases === 'failed') return tab === 'canvas' ? 'messages' : tab;
  if (tab === 'canvas') return canvases[0] ?? 'messages';
  return canvases.includes(tab) ? tab : 'messages';
}

const CUID_PATTERN = /^c[a-z0-9]{20,32}$/;

/**
 * The canvas id to warm right away while a room tab opens: the resolved canvas id when known,
 * or a CUID-shaped `?tab=<canvasId>` while the room's canvas list is still loading.
 */
export function prefetchTargetCanvasId(
  tab: string,
  active: string | null
): string | null {
  if (active) return active === 'messages' ? null : active;
  return CUID_PATTERN.test(tab) ? tab : null;
}

const DEFAULT_MAX_MOUNTED_CANVASES = 5;

/**
 * Keeps recently visited canvas tabs mounted (LRU) so switching between Messages and canvases
 * does not tear down the editor or reconnect Liveblocks, while pruning deleted canvases.
 */
export function updateMountedCanvasTabs(
  current: readonly string[],
  active: string | null,
  validIds: readonly string[] | null,
  maxMounted = DEFAULT_MAX_MOUNTED_CANVASES
): string[] {
  const allowed = validIds ? new Set(validIds) : null;
  const kept = allowed ? current.filter((id) => allowed.has(id)) : [...current];
  if (!active || active === 'messages') return kept;
  if (allowed && !allowed.has(active)) return kept;
  const next = kept.filter((id) => id !== active);
  next.push(active);
  return next.length > maxMounted ? next.slice(next.length - maxMounted) : next;
}
