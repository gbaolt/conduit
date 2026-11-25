import { describe, expect, it, vi } from 'vitest';

import {
  CANVAS_FULL_WIDTH_STORAGE_KEY,
  readCanvasFullWidth,
  subscribeCanvasFullWidth,
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

  it('keeps the in-memory value when setItem throws while getItem still returns stale data', () => {
    const map = new Map<string, string>([
      [CANVAS_FULL_WIDTH_STORAGE_KEY, 'false'],
    ]);
    const readOnly = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(readCanvasFullWidth(readOnly)).toBe(false);
    writeCanvasFullWidth(true, readOnly);
    expect(readCanvasFullWidth(readOnly)).toBe(true);
    writeCanvasFullWidth(false, readOnly);
    expect(readCanvasFullWidth(readOnly)).toBe(false);
  });

  it('refreshes subscribers on cross-tab key updates and localStorage.clear()', () => {
    const target = new EventTarget();
    const prevWindow = globalThis.window;
    // Minimal window stub for Node vitest environment.
    globalThis.window = target as unknown as Window & typeof globalThis;
    try {
      const listener = vi.fn();
      const unsubscribe = subscribeCanvasFullWidth(listener);

      const dispatch = (key: string | null) => {
        const event = new Event('storage');
        Object.defineProperty(event, 'key', { value: key });
        target.dispatchEvent(event);
      };

      dispatch('unrelated-key');
      expect(listener).not.toHaveBeenCalled();

      dispatch(CANVAS_FULL_WIDTH_STORAGE_KEY);
      expect(listener).toHaveBeenCalledTimes(1);

      dispatch(null);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
    } finally {
      globalThis.window = prevWindow;
    }
  });
});
