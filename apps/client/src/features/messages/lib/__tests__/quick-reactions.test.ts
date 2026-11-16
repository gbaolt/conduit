import { describe, expect, it } from 'vitest';

import {
  DEFAULT_QUICK_REACTIONS,
  parseQuickReactions,
  replaceQuickReaction,
} from '../quick-reactions';

describe('parseQuickReactions', () => {
  it('reads three stored emoji', () => {
    expect(parseQuickReactions('["🎉","👀","✅"]')).toEqual(['🎉', '👀', '✅']);
  });

  it('falls back to the defaults for missing or malformed storage', () => {
    for (const raw of [null, '', 'nope', '["🎉"]', '[1,2,3]', '["","a","b"]']) {
      expect(parseQuickReactions(raw)).toBe(DEFAULT_QUICK_REACTIONS);
    }
  });
});

describe('replaceQuickReaction', () => {
  it('puts a new emoji in the slot', () => {
    expect(replaceQuickReaction(['👍', '❤️', '😂'], 1, '🎉')).toEqual([
      '👍',
      '🎉',
      '😂',
    ]);
  });

  it('swaps when the emoji already sits in another slot', () => {
    expect(replaceQuickReaction(['👍', '❤️', '😂'], 0, '😂')).toEqual([
      '😂',
      '❤️',
      '👍',
    ]);
  });
});
