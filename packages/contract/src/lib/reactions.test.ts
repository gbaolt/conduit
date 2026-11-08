import { describe, expect, it } from 'vitest';

import { addReaction, REACTION_EMOJI_MAX, removeReaction } from './reactions';

describe('addReaction', () => {
  it('adds the first reaction of an emoji', () => {
    expect(addReaction({}, '👍', 'a')).toEqual({ '👍': ['a'] });
  });

  it('keeps earlier reactors in order', () => {
    expect(addReaction({ '👍': ['a'] }, '👍', 'b')).toEqual({
      '👍': ['a', 'b'],
    });
  });

  it('is a no-op for someone who already reacted', () => {
    const summary = { '👍': ['a'] };
    expect(addReaction(summary, '👍', 'a')).toBe(summary);
  });

  it('refuses a new emoji past the cap but accepts an existing one', () => {
    const full = Object.fromEntries(
      Array.from({ length: REACTION_EMOJI_MAX }, (_, i) => [`e${i}`, ['a']])
    );

    expect(addReaction(full, 'new', 'a')).toBeNull();
    expect(addReaction(full, 'e0', 'b')?.e0).toEqual(['a', 'b']);
  });
});

describe('removeReaction', () => {
  it('removes one reactor', () => {
    expect(removeReaction({ '👍': ['a', 'b'] }, '👍', 'a')).toEqual({
      '👍': ['b'],
    });
  });

  it('drops an emoji nobody uses', () => {
    expect(removeReaction({ '👍': ['a'], '🎉': ['b'] }, '👍', 'a')).toEqual({
      '🎉': ['b'],
    });
  });

  it('is a no-op for someone who did not react', () => {
    const summary = { '👍': ['a'] };
    expect(removeReaction(summary, '👍', 'z')).toBe(summary);
    expect(removeReaction(summary, '🎉', 'a')).toBe(summary);
  });
});
