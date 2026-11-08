'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyState = 'idle' | 'done' | 'error';

export type UseCopyOptions = {
  onCopySuccess?: (text: string) => void;
  onCopyError?: (error: Error) => void;
  resetDelay?: number;
};

/** Copies text to the clipboard, then reports `done` or `error` for `resetDelay` ms before going back to `idle`. */
export function useCopy({
  onCopySuccess,
  onCopyError,
  resetDelay = 1500,
}: UseCopyOptions = {}) {
  const [state, setState] = useState<CopyState>('idle');
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);
    },
    []
  );

  const copy = useCallback(
    async (text: string | (() => string)) => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);

      try {
        const finalText = typeof text === 'function' ? text() : text;
        await navigator.clipboard.writeText(finalText);
        setState('done');
        onCopySuccess?.(finalText);
      } catch (error) {
        setState('error');
        onCopyError?.(
          error instanceof Error ? error : new Error('Copy failed')
        );
      } finally {
        resetTimeout.current = setTimeout(() => setState('idle'), resetDelay);
      }
    },
    [onCopySuccess, onCopyError, resetDelay]
  );

  return { state, copy } as const;
}
