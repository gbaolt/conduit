import { describe, expect, it } from 'vitest';

import { matchSuggestions } from './mentions-plugin';

const source = [
  { id: 'channel', name: 'channel' },
  { id: 'u1', name: 'Linh Tran' },
  { id: 'u2', name: 'Bao Le' },
  { id: 'u3', name: 'Ann Linhart' },
];

describe('matchSuggestions', () => {
  it('lists everyone for an empty query', () => {
    expect(matchSuggestions(source, '')).toHaveLength(4);
  });

  it('puts names that start with the query before names that contain it', () => {
    expect(matchSuggestions(source, 'linh').map((s) => s.id)).toEqual([
      'u1',
      'u3',
    ]);
  });

  it('matches across a space and ignores case', () => {
    expect(matchSuggestions(source, 'LINH T').map((s) => s.id)).toEqual(['u1']);
  });
});
