import { describe, expect, it } from 'vitest';

import { dmKey } from './dm-key';

describe('dmKey', () => {
  it('gives the same key for the same people in any order', () => {
    expect(dmKey('org', ['b', 'a', 'c'])).toBe(dmKey('org', ['c', 'a', 'b']));
    expect(dmKey('org', ['b', 'a'])).toBe('org:a,b');
  });

  it('counts a repeated person once', () => {
    expect(dmKey('org', ['a', 'a', 'b'])).toBe(dmKey('org', ['a', 'b']));
  });

  it('keys the self DM by the one person', () => {
    expect(dmKey('org', ['a'])).toBe('org:a');
  });

  it('separates the same people in different workspaces', () => {
    expect(dmKey('one', ['a', 'b'])).not.toBe(dmKey('two', ['a', 'b']));
  });

  it('separates a group from the pair inside it', () => {
    expect(dmKey('org', ['a', 'b', 'c'])).not.toBe(dmKey('org', ['a', 'b']));
  });
});
