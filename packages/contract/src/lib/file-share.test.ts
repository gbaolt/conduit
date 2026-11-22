import { describe, expect, it } from 'vitest';

import { canAttachToRoom } from './file-share';

const from = (
  id: string,
  kind: 'channel' | 'dm',
  visibility: 'public' | 'private'
) => ({ room: { id, kind, visibility } });

describe('canAttachToRoom', () => {
  it('lets a public channel file go to another room', () => {
    expect(
      canAttachToRoom(from('design', 'channel', 'public'), 'general')
    ).toBe(true);
  });

  it('keeps a private channel file in its own channel', () => {
    expect(
      canAttachToRoom(from('leads', 'channel', 'private'), 'general')
    ).toBe(false);
    expect(canAttachToRoom(from('leads', 'channel', 'private'), 'leads')).toBe(
      true
    );
  });

  it('keeps a DM file in its own DM', () => {
    expect(canAttachToRoom(from('dm1', 'dm', 'private'), 'general')).toBe(
      false
    );
    expect(canAttachToRoom(from('dm1', 'dm', 'public'), 'general')).toBe(false);
    expect(canAttachToRoom(from('dm1', 'dm', 'private'), 'dm1')).toBe(true);
  });
});
