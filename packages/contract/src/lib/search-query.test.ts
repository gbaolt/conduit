import { describe, expect, it } from 'vitest';

import { parseSearchQuery, startOfDayIn, withoutFilter } from './search-query';

const filters = (text: string) =>
  parseSearchQuery(text).filters.map(({ raw: _raw, ...filter }) => filter);

describe('parseSearchQuery', () => {
  it('reads each filter, and leaves the rest as terms', () => {
    expect(
      parseSearchQuery(
        'pricing in:#design in:@linh from:@arjun has:file before:2026-11-01 after:2026-10-01 deck'
      )
    ).toEqual({
      terms: ['pricing', 'deck'],
      filters: [
        { raw: 'in:#design', key: 'in', target: 'channel', name: 'design' },
        { raw: 'in:@linh', key: 'in', target: 'person', name: 'linh' },
        { raw: 'from:@arjun', key: 'from', name: 'arjun' },
        { raw: 'has:file', key: 'has', value: 'file' },
        { raw: 'before:2026-11-01', key: 'before', date: '2026-11-01' },
        { raw: 'after:2026-10-01', key: 'after', date: '2026-10-01' },
      ],
    });
  });

  it('lets a filter repeat', () => {
    expect(filters('in:#a in:#b')).toEqual([
      { key: 'in', target: 'channel', name: 'a' },
      { key: 'in', target: 'channel', name: 'b' },
    ]);
  });

  it('reads keys in any case', () => {
    expect(filters('IN:#Design FROM:@Linh HAS:FILE')).toEqual([
      { key: 'in', target: 'channel', name: 'Design' },
      { key: 'from', name: 'Linh' },
      { key: 'has', value: 'file' },
    ]);
  });

  it('keeps malformed filters as terms', () => {
    expect(
      parseSearchQuery(
        'before:soon after:2026-02-30 in:design from:linh in:# has:link http://x'
      )
    ).toEqual({
      terms: [
        'before:soon',
        'after:2026-02-30',
        'in:design',
        'from:linh',
        'in:#',
        'has:link',
        'http://x',
      ],
      filters: [],
    });
  });

  it('reads a quoted name with spaces, and a quoted phrase as one term', () => {
    expect(parseSearchQuery('from:@"Linh Pham" "launch plan"')).toEqual({
      terms: ['launch plan'],
      filters: [{ raw: 'from:@"Linh Pham"', key: 'from', name: 'Linh Pham' }],
    });
  });

  it('never throws on a quote left open', () => {
    expect(parseSearchQuery('from:@"Linh').filters).toEqual([
      { raw: 'from:@"Linh', key: 'from', name: 'Linh' },
    ]);
  });
});

describe('withoutFilter', () => {
  it('removes one filter and keeps the rest', () => {
    const text = 'pricing from:@"Linh Pham"  has:file';
    const [from] = parseSearchQuery(text).filters;
    expect(withoutFilter(text, from!)).toBe('pricing has:file');
  });
});

describe('startOfDayIn', () => {
  it('finds midnight in the zone', () => {
    expect(startOfDayIn('2026-11-01', 'UTC').toISOString()).toBe(
      '2026-11-01T00:00:00.000Z'
    );
    expect(startOfDayIn('2026-11-01', 'Asia/Ho_Chi_Minh').toISOString()).toBe(
      '2026-10-31T17:00:00.000Z'
    );
    expect(startOfDayIn('2026-07-01', 'America/New_York').toISOString()).toBe(
      '2026-07-01T04:00:00.000Z'
    );
  });

  it('handles a day that starts in daylight time and ends in standard time', () => {
    expect(startOfDayIn('2026-11-01', 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z'
    );
  });
});
