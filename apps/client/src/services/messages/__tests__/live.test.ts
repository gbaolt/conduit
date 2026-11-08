import { describe, expect, it } from 'vitest';

import { utcTimestamp } from '../live';

describe('utcTimestamp', () => {
  it.each([
    ['2026-11-07 12:30:45.123', '2026-11-07T12:30:45.123Z'],
    ['2026-11-07 12:30:45.123456', '2026-11-07T12:30:45.123Z'],
    ['2026-11-07 12:30:45', '2026-11-07T12:30:45.000Z'],
  ])('reads %s as UTC', (text, iso) => {
    expect(utcTimestamp(text).toISOString()).toBe(iso);
  });
});
