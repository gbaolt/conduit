'use client';

import { parseAsBoolean, useQueryState } from 'nuqs';

/**
 * Whether the New message pane covers the main pane, kept in `?compose` so it opens beside either sidebar.
 * Opening pushes a history entry, so Back closes it.
 */
export function useCompose() {
  return useQueryState(
    'compose',
    parseAsBoolean.withOptions({ history: 'push' })
  );
}
