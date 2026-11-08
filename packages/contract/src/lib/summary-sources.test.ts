import { describe, expect, it } from 'vitest';

import { citedSourceIds } from './summary-sources';

describe('citedSourceIds', () => {
  it('lists each cited message once, in order of first citation', () => {
    expect(
      citedSourceIds([
        { text: 'a', sourceIds: ['m2', 'm1'] },
        { text: 'b', sourceIds: ['m1', 'm3'] },
      ])
    ).toEqual(['m2', 'm1', 'm3']);
  });

  it('is empty without bullets', () => {
    expect(citedSourceIds([])).toEqual([]);
  });
});
