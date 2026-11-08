import { describe, expect, it } from 'vitest';

import { citedBullets } from './summary-citations';

const labels = new Map([
  ['m1', 'cm-1'],
  ['m2', 'cm-2'],
]);

describe('citedBullets', () => {
  it('maps labels to message ids and drops each label the model invented', () => {
    expect(
      citedBullets(
        { bullets: [{ text: 'a', sourceIds: ['m2', 'm9', 'm1', 'm2'] }] },
        labels
      )
    ).toEqual([{ text: 'a', sourceIds: ['cm-2', 'cm-1'] }]);
  });

  it('drops a bullet left with no source', () => {
    expect(
      citedBullets(
        {
          bullets: [
            { text: 'invented', sourceIds: ['m9'] },
            { text: 'uncited', sourceIds: [] },
            { text: 'kept', sourceIds: ['m1'] },
          ],
        },
        labels
      )
    ).toEqual([{ text: 'kept', sourceIds: ['cm-1'] }]);
  });

  it('drops a bullet with blank text', () => {
    expect(
      citedBullets({ bullets: [{ text: '  ', sourceIds: ['m1'] }] }, labels)
    ).toEqual([]);
  });

  it('holds a bullet back until a source of it has arrived', () => {
    expect(citedBullets({ bullets: [{ text: 'half' }] }, labels)).toEqual([]);
    expect(
      citedBullets({ bullets: [{ text: 'half', sourceIds: ['m'] }] }, labels)
    ).toEqual([]);
    expect(
      citedBullets(
        { bullets: [{ text: 'half', sourceIds: ['m1', undefined] }] },
        labels
      )
    ).toEqual([{ text: 'half', sourceIds: ['cm-1'] }]);
  });

  it('is empty before the model writes anything', () => {
    expect(citedBullets(undefined, labels)).toEqual([]);
    expect(citedBullets({}, labels)).toEqual([]);
    expect(citedBullets({ bullets: [undefined] }, labels)).toEqual([]);
  });
});
