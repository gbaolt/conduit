import { useSyncExternalStore } from 'react';

export const CANVAS_FULL_WIDTH_STORAGE_KEY = 'conduit:canvas:full-width';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const listeners = new Set<() => void>();
let fallbackValue = false;

function notify() {
  for (const listener of listeners) listener();
}

/** Reads the viewer's full-width preference without throwing if storage is blocked or absent. */
export function readCanvasFullWidth(storage?: StorageLike | null): boolean {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return fallbackValue;
    return target.getItem(CANVAS_FULL_WIDTH_STORAGE_KEY) === 'true';
  } catch {
    return fallbackValue;
  }
}

/** Saves the viewer's full-width preference without throwing if storage is blocked or full. */
export function writeCanvasFullWidth(
  value: boolean,
  storage?: StorageLike | null
): void {
  fallbackValue = value;
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(CANVAS_FULL_WIDTH_STORAGE_KEY, String(value));
  } catch {
    // Keep the in-memory fallback when localStorage is unavailable.
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CANVAS_FULL_WIDTH_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const setCanvasFullWidth = (next: boolean) => writeCanvasFullWidth(next);

/** Per-viewer full-width preference, kept in localStorage and safe when storage is unavailable. */
export function useCanvasFullWidth(): [boolean, (next: boolean) => void] {
  const fullWidth = useSyncExternalStore(
    subscribe,
    () => readCanvasFullWidth(),
    () => false
  );
  return [fullWidth, setCanvasFullWidth];
}
