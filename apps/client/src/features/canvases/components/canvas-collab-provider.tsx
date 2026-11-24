'use client';

import type { CanvasLiveblocksAuth } from '@conduit/contract';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
import { Button } from '@conduit/ui/components/button';
import { LiveblocksProvider, RoomProvider } from '@liveblocks/react';
import { ORPCError } from '@orpc/client';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useRef, useState } from 'react';

import { useCanvasLiveblocksToken } from '@/services/canvases/hooks';
import { canvasLiveblocksAuthQuery } from '@/services/canvases/queries';

declare global {
  interface Liveblocks {
    UserMeta: {
      id: string;
      info: { name: string; image: string | null; color: string };
    };
    /** Tells everyone else on the canvas to refetch its comments or its versions. */
    RoomEvent: { type: 'COMMENTS_CHANGED' } | { type: 'VERSIONS_CHANGED' };
  }
}

/** Whether the open canvas is edited live, and the viewer's cursor color when it is. */
export type CanvasCollab =
  | { live: false }
  | { live: true; color: string; deniedReason: string | null };

const CanvasCollabContext = createContext<CanvasCollab>({ live: false });

export function useCanvasCollab() {
  return use(CanvasCollabContext);
}

/**
 * Joins the canvas's Liveblocks room, or leaves the canvas single-user when the server has no Liveblocks key.
 * Renders `fallback` until it knows which.
 */
export function CanvasCollabProvider({
  canvasId,
  fallback,
  children,
}: {
  canvasId: string;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const auth = useQuery(canvasLiveblocksAuthQuery(canvasId));

  if (auth.isPending) return fallback;
  if (auth.isError) {
    return (
      <Alert role="alert">
        <IconAlertTriangle />
        <AlertTitle>Couldn&apos;t open live editing</AlertTitle>
        <AlertDescription>
          Check your connection, then try again.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => auth.refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }
  if (!auth.data.enabled) {
    return (
      <CanvasCollabContext value={{ live: false }}>
        {children}
      </CanvasCollabContext>
    );
  }
  return (
    <CanvasCollabRoom canvasId={canvasId} auth={auth.data}>
      {children}
    </CanvasCollabRoom>
  );
}

function CanvasCollabRoom({
  canvasId,
  auth,
  children,
}: {
  canvasId: string;
  auth: Extract<CanvasLiveblocksAuth, { enabled: true }>;
  children: ReactNode;
}) {
  const refresh = useCanvasLiveblocksToken();
  const [deniedReason, setDeniedReason] = useState<string | null>(null);
  // The token that decided live mode opens the first connection, so opening a canvas costs one auth call.
  const firstToken = useRef<string | null>(auth.token);

  const authEndpoint = async () => {
    const token = firstToken.current;
    firstToken.current = null;
    if (token) return { token };
    const next = await refresh
      .mutateAsync({ canvasId })
      .catch((error: unknown) => {
        // Liveblocks retries any other failure; a canvas the viewer lost access to never comes back.
        if (error instanceof ORPCError && error.code === 'NOT_FOUND') {
          return null;
        }
        throw error;
      });
    if (!next) {
      const reason = 'You can no longer open this canvas.';
      setDeniedReason(reason);
      return { error: 'forbidden', reason };
    }
    if (!next.enabled) {
      const reason = 'Live editing is turned off.';
      setDeniedReason(reason);
      return { error: 'forbidden', reason };
    }
    setDeniedReason(null);
    return { token: next.token };
  };

  return (
    <LiveblocksProvider authEndpoint={authEndpoint}>
      <RoomProvider id={auth.roomId} initialPresence={{}}>
        <CanvasCollabContext
          value={{ live: true, color: auth.color, deniedReason }}
        >
          {children}
        </CanvasCollabContext>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
