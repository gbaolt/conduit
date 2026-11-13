import { describe, expect, it } from 'vitest';

import { UpdateNotificationSettingsInputSchema } from './notifications';

const parse = (input: unknown) =>
  UpdateNotificationSettingsInputSchema.safeParse(input).success;

describe('UpdateNotificationSettingsInputSchema', () => {
  it('accepts any subset of the settings', () => {
    expect(parse({})).toBe(true);
    expect(parse({ dndUntil: new Date(), emailDigest: false })).toBe(true);
    expect(parse({ timeZone: 'Asia/Ho_Chi_Minh' })).toBe(true);
  });

  it('refuses a time zone Intl does not know', () => {
    expect(parse({ timeZone: 'Mars/Olympus' })).toBe(false);
  });

  it('refuses a schedule whose times are not HH:MM, or that starts and ends together', () => {
    const schedule = { days: [1], start: '22:00', end: '08:00' };

    expect(parse({ dndSchedule: schedule })).toBe(true);
    expect(parse({ dndSchedule: { ...schedule, start: '8pm' } })).toBe(false);
    expect(parse({ dndSchedule: { ...schedule, end: '24:00' } })).toBe(false);
    expect(parse({ dndSchedule: { ...schedule, end: '22:00' } })).toBe(false);
    expect(parse({ dndSchedule: { ...schedule, days: [] } })).toBe(false);
  });
});
