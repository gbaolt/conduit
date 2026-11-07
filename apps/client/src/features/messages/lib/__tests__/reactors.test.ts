import { describe, expect, it } from 'vitest';

import { reactorLabel } from '../reactors';

const names = new Map([
  ['a', 'Linh'],
  ['b', 'Bao'],
  ['c', 'Mai'],
  ['d', 'Nam'],
  ['e', 'Oanh'],
]);

describe('reactorLabel', () => {
  it('names one reactor', () => {
    expect(reactorLabel(['a'], names, null)).toBe('Linh');
  });

  it('joins two and three names', () => {
    expect(reactorLabel(['a', 'b'], names, null)).toBe('Linh and Bao');
    expect(reactorLabel(['a', 'b', 'c'], names, null)).toBe(
      'Linh, Bao, and Mai'
    );
  });

  it('counts the rest past three', () => {
    expect(reactorLabel(['a', 'b', 'c', 'd', 'e'], names, null)).toBe(
      'Linh, Bao, and 3 others'
    );
  });

  it('puts the viewer first as You', () => {
    expect(reactorLabel(['a', 'b'], names, 'b')).toBe('You and Linh');
  });

  it('names a member who left as a former member', () => {
    expect(reactorLabel(['ghost'], names, null)).toBe('Former member');
  });
});
