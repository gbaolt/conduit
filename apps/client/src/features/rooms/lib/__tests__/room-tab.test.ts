import { describe, expect, it } from 'vitest';

import { resolveRoomTab } from '../room-tab';

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
