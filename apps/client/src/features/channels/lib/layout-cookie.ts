/** Panel id to percent of the group, the shape `react-resizable-panels` saves and restores. */
export type Layout = Record<string, number>;

export const LAYOUT_COOKIE = 'conduit-layout';
export const CHANNELS_PANEL = 'channels';
export const MAIN_PANEL = 'main';

/** The saved layout, or undefined when the cookie is missing, malformed, or for other panels. */
export function parseLayout(value: string | undefined): Layout | undefined {
  if (!value) return undefined;

  try {
    const layout: unknown = JSON.parse(value);

    if (
      typeof layout === 'object' &&
      layout !== null &&
      [CHANNELS_PANEL, MAIN_PANEL].every((id) =>
        Number.isFinite((layout as Layout)[id])
      )
    ) {
      return layout as Layout;
    }
  } catch {
    // A malformed cookie falls back to the default layout.
  }

  return undefined;
}

export function writeLayoutCookie(layout: Layout) {
  const value = encodeURIComponent(JSON.stringify(layout));

  document.cookie = `${LAYOUT_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}
