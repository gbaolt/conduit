/** What the channel's canvas list is while the tab is chosen. */
export type ChannelCanvasIds = readonly string[] | 'pending' | 'failed';

/**
 * The tab `?tab=` opens: `messages`, a canvas id, or null while the canvases load. `canvas`, from links made when
 * a channel had one canvas, opens the first one. An id the loaded list lacks, such as a deleted canvas, falls back
 * to Messages. When the list failed, an id is still opened, so its own view shows why it cannot load.
 */
export function resolveChannelTab(
  tab: string,
  canvases: ChannelCanvasIds
): string | null {
  if (tab === 'messages') return tab;
  if (canvases === 'pending') return null;
  if (canvases === 'failed') return tab === 'canvas' ? 'messages' : tab;
  if (tab === 'canvas') return canvases[0] ?? 'messages';
  return canvases.includes(tab) ? tab : 'messages';
}
