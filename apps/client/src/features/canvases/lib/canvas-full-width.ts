export const CANVAS_FULL_WIDTH_STORAGE_KEY = 'conduit:canvas:full-width';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const listeners = new Set<() => void>();
const failedWrites = new WeakMap<StorageLike, boolean>();
let nullStorageValue = false;

function notify() {
  for (const listener of listeners) listener();
}

/** Reads the viewer's full-width preference without throwing if storage is blocked or absent. */
export function readCanvasFullWidth(storage?: StorageLike | null): boolean {
  let target: StorageLike | null | undefined;
  try {
    target = storage === undefined ? globalThis.localStorage : storage;
  } catch {
    return nullStorageValue;
  }
  if (!target) return nullStorageValue;
  if (failedWrites.has(target)) return failedWrites.get(target)!;
  try {
    return target.getItem(CANVAS_FULL_WIDTH_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Saves the viewer's full-width preference without throwing if storage is blocked or full. */
export function writeCanvasFullWidth(
  value: boolean,
  storage?: StorageLike | null
): void {
  let target: StorageLike | null | undefined;
  try {
    target = storage === undefined ? globalThis.localStorage : storage;
  } catch {
    nullStorageValue = value;
    notify();
    return;
  }
  if (!target) {
    nullStorageValue = value;
    notify();
    return;
  }
  try {
    target.setItem(CANVAS_FULL_WIDTH_STORAGE_KEY, String(value));
    failedWrites.delete(target);
  } catch {
    // Keep the in-memory value when writes fail so a working getItem does not snap it back.
    failedWrites.set(target, value);
  }
  notify();
}

/** Subscribes to same-tab writes and cross-tab storage updates or clears (`event.key === null`). */
export function subscribeCanvasFullWidth(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== CANVAS_FULL_WIDTH_STORAGE_KEY)
      return;
    try {
      failedWrites.delete(globalThis.localStorage);
    } catch {
      // Ignore if localStorage itself cannot be accessed.
    }
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
