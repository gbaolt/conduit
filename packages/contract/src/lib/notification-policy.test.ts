import { describe, expect, it } from 'vitest';

import {
  effectiveNotify,
  isDndActive,
  isValidTimeZone,
} from './notification-policy';

const overnight = { days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '08:00' };
const settings = (
  patch: Partial<Parameters<typeof isDndActive>[0]> = {}
): Parameters<typeof isDndActive>[0] => ({
  dndUntil: null,
  dndSchedule: null,
  timeZone: 'UTC',
  ...patch,
});

describe('effectiveNotify', () => {
  it('defaults to mentions in a channel and every message in a DM', () => {
    expect(effectiveNotify('channel', null)).toBe('mentions');
    expect(effectiveNotify('dm', null)).toBe('all');
  });

  it('keeps a chosen level in either kind', () => {
    expect(effectiveNotify('channel', 'nothing')).toBe('nothing');
    expect(effectiveNotify('dm', 'mentions')).toBe('mentions');
  });
});

describe('isDndActive', () => {
  const now = new Date('2026-11-13T12:00:00Z');

  it('is off with no snooze and no schedule', () => {
    expect(isDndActive(settings(), now)).toBe(false);
  });

  it('is on until a snooze in the future, and off for one in the past', () => {
    expect(
      isDndActive(settings({ dndUntil: new Date('2026-11-13T12:30:00Z') }), now)
    ).toBe(true);
    expect(
      isDndActive(settings({ dndUntil: new Date('2026-11-13T11:59:00Z') }), now)
    ).toBe(false);
  });

  it('reads a schedule in the member time zone, so 22:00 to 08:00 is on at 23:00 local', () => {
    const tokyo = settings({ dndSchedule: overnight, timeZone: 'Asia/Tokyo' });

    // 14:00Z is 23:00 in Tokyo and 14:00 in UTC.
    expect(isDndActive(tokyo, new Date('2026-11-13T14:00:00Z'))).toBe(true);
    expect(isDndActive(tokyo, new Date('2026-11-13T00:00:00Z'))).toBe(false);
  });

  it('runs a schedule past midnight into the next morning, and stops at the end time', () => {
    const night = settings({ dndSchedule: overnight });

    expect(isDndActive(night, new Date('2026-11-14T02:00:00Z'))).toBe(true);
    expect(isDndActive(night, new Date('2026-11-14T07:59:00Z'))).toBe(true);
    expect(isDndActive(night, new Date('2026-11-14T08:00:00Z'))).toBe(false);
  });

  it('is off on a day the schedule leaves out, and the morning after belongs to the day it started', () => {
    // Friday only: Friday 23:00 and Saturday 02:00 are on, Thursday 23:00 and Friday 02:00 are off.
    const friday = settings({ dndSchedule: { ...overnight, days: [5] } });

    expect(isDndActive(friday, new Date('2026-11-13T23:00:00Z'))).toBe(true);
    expect(isDndActive(friday, new Date('2026-11-14T02:00:00Z'))).toBe(true);
    expect(isDndActive(friday, new Date('2026-11-12T23:00:00Z'))).toBe(false);
    expect(isDndActive(friday, new Date('2026-11-13T02:00:00Z'))).toBe(false);
  });

  it('reads a same-day schedule between its start and end only', () => {
    const work = settings({
      dndSchedule: { days: [1], start: '09:00', end: '17:00' },
    });

    expect(isDndActive(work, new Date('2026-11-16T12:00:00Z'))).toBe(true);
    expect(isDndActive(work, new Date('2026-11-16T17:00:00Z'))).toBe(false);
    expect(isDndActive(work, new Date('2026-11-17T12:00:00Z'))).toBe(false);
  });

  it('follows the clock across the New York DST change on 2026-03-08', () => {
    const newYork = settings({
      dndSchedule: overnight,
      timeZone: 'America/New_York',
    });

    // 11:00Z is 07:00 EDT after the change (06:00 EST would still be inside), 12:30Z is 08:30 EDT.
    expect(isDndActive(newYork, new Date('2026-03-08T11:00:00Z'))).toBe(true);
    expect(isDndActive(newYork, new Date('2026-03-08T12:30:00Z'))).toBe(false);
    // 12:00Z is exactly 08:00 EDT, where the window ends. An EST reading would be 07:00 and still inside.
    expect(isDndActive(newYork, new Date('2026-03-08T12:00:00Z'))).toBe(false);
    // Back in November the same 08:00 end is 13:00Z.
    expect(isDndActive(newYork, new Date('2026-11-01T12:59:00Z'))).toBe(true);
    expect(isDndActive(newYork, new Date('2026-11-01T13:00:00Z'))).toBe(false);
  });
});

describe('isValidTimeZone', () => {
  it('accepts an IANA zone and refuses anything else', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
