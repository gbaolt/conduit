'use client';

import { useBroadcastEvent, useEventListener } from '@liveblocks/react';
import { type RefObject, useEffect } from 'react';

import { useInvalidateCanvasVersions } from '@/services/canvases/hooks';

/**
 * On a live canvas, refetches the version list when someone else saves or restores a version, and points
 * `notifyRef` at the broadcast that tells everyone else to.
 */
export function CanvasHistoryPanelSync({
  canvasId,
  notifyRef,
}: {
  canvasId: string;
  notifyRef: RefObject<() => void>;
}) {
  const invalidate = useInvalidateCanvasVersions();
  const broadcast = useBroadcastEvent();
  useEventListener(({ event }) => {
    if (event.type === 'VERSIONS_CHANGED') void invalidate({ canvasId });
  });
  useEffect(() => {
    notifyRef.current = () => broadcast({ type: 'VERSIONS_CHANGED' });
  }, [broadcast, notifyRef]);
  return null;
}
