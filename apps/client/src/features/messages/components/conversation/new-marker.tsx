'use client';

import { Badge } from '@conduit/ui/components/badge';
import { useMessageScrollerVisibility } from '@conduit/ui/components/message-scroller';
import { useEffect, useState, useSyncExternalStore } from 'react';

export const NEW_MARKER_MS = 5000;

function subscribeToPageVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/**
 * Tags the top of the first unread message, then fades out once the viewer has had it on screen, with the tab in
 * front, for `NEW_MARKER_MS`. It takes no height, so fading it never moves the log.
 */
export function NewMarker({ messageId }: { messageId: string }) {
  const { visibleMessageIds } = useMessageScrollerVisibility();
  const pageVisible = useSyncExternalStore(
    subscribeToPageVisibility,
    () => document.visibilityState === 'visible',
    () => false
  );
  const [seen, setSeen] = useState(false);
  const [expired, setExpired] = useState(false);

  if (!seen && pageVisible && visibleMessageIds.includes(messageId)) {
    setSeen(true);
  }

  useEffect(() => {
    if (!seen) return;
    const timer = setTimeout(() => setExpired(true), NEW_MARKER_MS);
    return () => clearTimeout(timer);
  }, [seen]);

  return (
    <div
      role="separator"
      aria-label="New messages"
      aria-hidden={expired || undefined}
      data-expired={expired || undefined}
      className="relative z-10 h-0 transition-opacity duration-500 data-expired:opacity-0"
    >
      <div className="bg-primary/40 absolute inset-x-5 top-0 h-px" />
      <Badge className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
        New
      </Badge>
    </div>
  );
}
