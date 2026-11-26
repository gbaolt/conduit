import { describe, expect, it } from 'vitest';

import { canvasHref } from '../canvas-href';

describe('canvasHref', () => {
  it('opens a room canvas as a tab of its channel or DM', () => {
    expect(canvasHref({ id: 'c1', roomId: 'r1', roomKind: 'channel' })).toBe(
      '/channels/r1?tab=c1'
    );
    expect(canvasHref({ id: 'c1', roomId: 'r1', roomKind: 'dm' })).toBe(
      '/dms/r1?tab=c1'
    );
  });

  it('opens a standalone canvas on its own page', () => {
    expect(canvasHref({ id: 'c1', roomId: null, roomKind: null })).toBe(
      '/canvases/c1'
    );
  });
});
