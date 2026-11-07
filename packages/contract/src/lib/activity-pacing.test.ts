import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activeTypers,
  createLeadingGate,
  createTrailingWriter,
  ONLINE_WINDOW_MS,
  presenceStatus,
  TYPING_PING_INTERVAL_MS,
} from './activity-pacing';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createLeadingGate', () => {
  it('lets one typing ping through per 3 s', () => {
    const gate = createLeadingGate(TYPING_PING_INTERVAL_MS);
    let pings = 0;

    // Ten keystrokes a second for ten seconds.
    for (let tick = 0; tick < 100; tick++) {
      if (gate()) pings++;
      vi.advanceTimersByTime(100);
    }

    expect(pings).toBe(4);
  });
});

describe('createTrailingWriter', () => {
  const setup = (minIntervalMs = 5000) => {
    const write = vi.fn<(value: string) => void>();
    const writer = createTrailingWriter(write, {
      debounceMs: 1000,
      minIntervalMs,
    });
    return { write, writer };
  };

  it('writes the latest value 1 s after the last push', () => {
    const { write, writer } = setup();

    writer.push('h');
    vi.advanceTimersByTime(600);
    writer.push('hi');
    vi.advanceTimersByTime(999);
    expect(write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledExactlyOnceWith('hi');
  });

  it('waits out the minimum interval after a write', () => {
    const { write, writer } = setup();
    writer.push('a');
    vi.advanceTimersByTime(1000);

    writer.push('b');
    vi.advanceTimersByTime(4000);
    expect(write).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenLastCalledWith('b');
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('writes a pending value on flush, and only once', () => {
    const { write, writer } = setup();
    writer.push('draft');

    writer.flush();
    writer.flush();
    vi.advanceTimersByTime(10_000);

    expect(write).toHaveBeenCalledExactlyOnceWith('draft');
  });
});

describe('presenceStatus', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const seen = (msAgo: number, away = false) => ({
    lastActiveAt: new Date(now - msAgo),
    away,
  });

  it('is online under 2 minutes after a heartbeat', () => {
    expect(presenceStatus(seen(ONLINE_WINDOW_MS - 1), now)).toBe('online');
  });

  it.each([
    ['a heartbeat 2 minutes old', seen(ONLINE_WINDOW_MS)],
    ['a hidden tab', seen(1000, true)],
    ['no heartbeat at all', undefined],
  ])('is away for %s', (_, row) => {
    expect(presenceStatus(row, now)).toBe('away');
  });
});

describe('activeTypers', () => {
  it('drops rows whose time has passed', () => {
    const now = 10_000;
    const rows = [
      { userId: 'a', until: new Date(now + 1) },
      { userId: 'b', until: new Date(now) },
    ];

    expect(activeTypers(rows, now).map((row) => row.userId)).toEqual(['a']);
  });
});
