import { describe, expect, it } from 'vitest';

import { resolveChannelTab } from './channel-tab';

describe('resolveChannelTab', () => {
  it('opens Messages without waiting for the canvases', () => {
    expect(resolveChannelTab('messages', 'pending')).toBe('messages');
  });

  it('waits for the canvases before opening one', () => {
    expect(resolveChannelTab('c1', 'pending')).toBeNull();
    expect(resolveChannelTab('canvas', 'pending')).toBeNull();
  });

  it('opens a canvas of the channel by id', () => {
    expect(resolveChannelTab('c2', ['c1', 'c2'])).toBe('c2');
  });

  it('opens the first canvas for an old ?tab=canvas link', () => {
    expect(resolveChannelTab('canvas', ['c1', 'c2'])).toBe('c1');
    expect(resolveChannelTab('canvas', [])).toBe('messages');
  });

  it('falls back to Messages for a canvas the channel no longer has', () => {
    expect(resolveChannelTab('gone', ['c1'])).toBe('messages');
  });

  it('still opens an id when the list failed, so its view can explain', () => {
    expect(resolveChannelTab('c1', 'failed')).toBe('c1');
    expect(resolveChannelTab('canvas', 'failed')).toBe('messages');
  });
});
