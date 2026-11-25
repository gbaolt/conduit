import { describe, expect, it } from 'vitest';

import {
  CANVAS_FULL_WIDTH_STORAGE_KEY,
  readCanvasFullWidth,
  writeCanvasFullWidth,
} from '../canvas-full-width';

describe('canvas full-width preference', () => {
  it('reads and writes through storage', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };

    expect(readCanvasFullWidth(storage)).toBe(false);
    writeCanvasFullWidth(true, storage);
    expect(map.get(CANVAS_FULL_WIDTH_STORAGE_KEY)).toBe('true');
    expect(readCanvasFullWidth(storage)).toBe(true);
    writeCanvasFullWidth(false, storage);
    expect(readCanvasFullWidth(storage)).toBe(false);
  });

  it('falls back safely when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(() => writeCanvasFullWidth(true, broken)).not.toThrow();
    expect(readCanvasFullWidth(broken)).toBe(true);
    expect(() => writeCanvasFullWidth(false, broken)).not.toThrow();
    expect(readCanvasFullWidth(broken)).toBe(false);
  });
});
