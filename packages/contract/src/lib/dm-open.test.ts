import { describe, expect, it } from 'vitest';

import { isDmOpen } from './dm-open';

const closed = new Date('2026-11-10T10:00:00Z');

describe('isDmOpen', () => {
  it('is open when the member never closed it', () => {
    expect(isDmOpen(null, null)).toBe(true);
    expect(isDmOpen(null, closed)).toBe(true);
  });

  it('is closed when nothing was sent since', () => {
    expect(isDmOpen(closed, null)).toBe(false);
    expect(isDmOpen(closed, new Date('2026-11-10T09:59:59Z'))).toBe(false);
    expect(isDmOpen(closed, closed)).toBe(false);
  });

  it('is open again once a message arrives after the close', () => {
    expect(isDmOpen(closed, new Date('2026-11-10T10:00:01Z'))).toBe(true);
  });
});
