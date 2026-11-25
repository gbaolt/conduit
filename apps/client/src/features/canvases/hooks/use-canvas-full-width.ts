'use client';

import { useSyncExternalStore } from 'react';

import {
  readCanvasFullWidth,
  subscribeCanvasFullWidth,
  writeCanvasFullWidth,
} from '../lib/canvas-full-width';

const setCanvasFullWidth = (next: boolean) => writeCanvasFullWidth(next);

/** Per-viewer full-width preference, kept in localStorage and safe when storage is unavailable. */
export function useCanvasFullWidth(): [boolean, (next: boolean) => void] {
  const fullWidth = useSyncExternalStore(
    subscribeCanvasFullWidth,
    () => readCanvasFullWidth(),
    () => false
  );
  return [fullWidth, setCanvasFullWidth];
}
