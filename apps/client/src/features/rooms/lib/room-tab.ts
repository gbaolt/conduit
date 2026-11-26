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
