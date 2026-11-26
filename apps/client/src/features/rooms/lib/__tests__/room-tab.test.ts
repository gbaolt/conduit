import { describe, expect, it } from 'vitest';

import {
  prefetchTargetCanvasId,
  resolveRoomTab,
  updateMountedCanvasTabs,
} from '../room-tab';

describe('resolveRoomTab', () => {
  it('opens Messages without waiting for the canvases', () => {
    expect(resolveRoomTab('messages', 'pending')).toBe('messages');
  });

  it('waits for the canvases before opening one', () => {
    expect(resolveRoomTab('c1', 'pending')).toBeNull();
    expect(resolveRoomTab('canvas', 'pending')).toBeNull();
  });

  it('opens a canvas of the room by id', () => {
    expect(resolveRoomTab('c2', ['c1', 'c2'])).toBe('c2');
  });

  it('opens the first canvas for an old ?tab=canvas link', () => {
    expect(resolveRoomTab('canvas', ['c1', 'c2'])).toBe('c1');
    expect(resolveRoomTab('canvas', [])).toBe('messages');
  });

  it('falls back to Messages for a canvas the room no longer has', () => {
    expect(resolveRoomTab('gone', ['c1'])).toBe('messages');
  });

  it('still opens an id when the list failed, so its view can explain', () => {
    expect(resolveRoomTab('c1', 'failed')).toBe('c1');
    expect(resolveRoomTab('canvas', 'failed')).toBe('messages');
  });
});

describe('prefetchTargetCanvasId', () => {
  const validCuid = 'cm1234567890abcdefghij123';

  it('returns the resolved canvas id when active is a canvas', () => {
    expect(prefetchTargetCanvasId('c1', 'c1')).toBe('c1');
    expect(prefetchTargetCanvasId('canvas', 'c1')).toBe('c1');
    expect(prefetchTargetCanvasId(validCuid, validCuid)).toBe(validCuid);
  });

  it('returns null when active resolved to Messages', () => {
    expect(prefetchTargetCanvasId('messages', 'messages')).toBeNull();
    expect(prefetchTargetCanvasId('gone', 'messages')).toBeNull();
  });

  it('returns a CUID-shaped ?tab=<canvasId> while the room canvases list is still pending', () => {
    expect(prefetchTargetCanvasId(validCuid, null)).toBe(validCuid);
  });

  it('returns null while pending for typos, arbitrary strings, or reserved tab names', () => {
    expect(prefetchTargetCanvasId('messages', null)).toBeNull();
    expect(prefetchTargetCanvasId('canvas', null)).toBeNull();
    expect(prefetchTargetCanvasId('', null)).toBeNull();
    expect(prefetchTargetCanvasId('c1', null)).toBeNull();
    expect(prefetchTargetCanvasId('not-a-cuid', null)).toBeNull();
    expect(
      prefetchTargetCanvasId('CM1234567890abcdefghij123', null)
    ).toBeNull();
  });
});

describe('updateMountedCanvasTabs', () => {
  it('leaves mounted list empty while on Messages or pending', () => {
    expect(updateMountedCanvasTabs([], 'messages', ['c1'])).toEqual([]);
    expect(updateMountedCanvasTabs([], null, null)).toEqual([]);
  });

  it('keeps visited canvases mounted when switching back to Messages', () => {
    const visited = updateMountedCanvasTabs([], 'c1', ['c1', 'c2']);
    expect(visited).toEqual(['c1']);
    expect(updateMountedCanvasTabs(visited, 'messages', ['c1', 'c2'])).toEqual([
      'c1',
    ]);
  });

  it('moves a revisited canvas to the most-recent slot and evicts the oldest past the cap', () => {
    const afterTwo = updateMountedCanvasTabs(
      ['c1'],
      'c2',
      ['c1', 'c2', 'c3'],
      2
    );
    expect(afterTwo).toEqual(['c1', 'c2']);
    const revisited = updateMountedCanvasTabs(
      afterTwo,
      'c1',
      ['c1', 'c2', 'c3'],
      2
    );
    expect(revisited).toEqual(['c2', 'c1']);
    const evicted = updateMountedCanvasTabs(
      revisited,
      'c3',
      ['c1', 'c2', 'c3'],
      2
    );
    expect(evicted).toEqual(['c1', 'c3']);
  });

  it('prunes canvases removed from the room', () => {
    expect(updateMountedCanvasTabs(['c1', 'c2'], 'messages', ['c2'])).toEqual([
      'c2',
    ]);
  });
});
