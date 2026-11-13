import { describe, expect, it } from 'vitest';

import { nameList } from '../name-list';

describe('nameList', () => {
  it('lists up to three names and sums up the rest', () => {
    expect(nameList(['Linh'])).toBe('Linh');
    expect(nameList(['Linh', 'Bao'])).toBe('Linh and Bao');
    expect(nameList(['Linh', 'Bao', 'Mai'])).toBe('Linh, Bao, and Mai');
    expect(nameList(['Linh', 'Bao', 'Mai', 'An'])).toBe(
      'Linh, Bao, and 2 others'
    );
  });
});
