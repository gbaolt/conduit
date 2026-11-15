import { describe, expect, it } from 'vitest';

import { dmTime } from '../dm-time';

const now = new Date(2026, 10, 15, 16, 30);
const at = (...parts: [number, number, number, number, number]) =>
  new Date(...parts);

describe('dmTime', () => {
  it('says Now within the first minute', () => {
    expect(
      dmTime(at(2026, 10, 15, 16, 29), new Date(2026, 10, 15, 16, 29, 40))
    ).toBe('Now');
  });

  it('counts minutes within the hour', () => {
    expect(dmTime(at(2026, 10, 15, 16, 18), now)).toBe('12 min');
  });

  it('shows the time for earlier today', () => {
    const date = at(2026, 10, 15, 9, 5);
    expect(dmTime(date, now)).toBe(
      new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
    );
  });

  it('says Yesterday for the day before, even under 24 hours ago', () => {
    expect(dmTime(at(2026, 10, 14, 23, 50), now)).toBe('Yesterday');
  });

  it('shows the weekday within the week, then the date', () => {
    const thisWeek = at(2026, 10, 11, 12, 0);
    const earlier = at(2026, 7, 25, 12, 0);
    expect(dmTime(thisWeek, now)).toBe(
      new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(thisWeek)
    );
    expect(dmTime(earlier, now)).toBe(
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(earlier)
    );
  });

  it('adds the year for an earlier year', () => {
    const date = at(2025, 7, 25, 12, 0);
    expect(dmTime(date, now)).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
    );
  });
});
