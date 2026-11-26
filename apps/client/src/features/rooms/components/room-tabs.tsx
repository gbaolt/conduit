'use client';

import { canChannel, type Canvas } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@conduit/ui/components/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { Twemoji } from '@conduit/ui/components/twemoji';
import {
  IconLayoutBoard,
  IconMessageCircle,
  IconPlus,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useQueryState } from 'nuqs';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { CanvasViewSkeleton } from '@/features/canvases/components/canvas-view-skeleton';
import { useCreateCanvas } from '@/services/canvases/hooks';
import { canvasQuery, roomCanvasesQuery } from '@/services/canvases/queries';
import { roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import {
  prefetchTargetCanvasId,
  resolveRoomTab,
  type RoomCanvasIds,
  roomTabParam,
  updateMountedCanvasTabs,
} from '../lib/room-tab';

const CanvasViewById = dynamic(
  () =>
    import('@/features/canvases/components/canvas-view').then(
      (m) => m.CanvasViewById
    ),
  { ssr: false, loading: () => <CanvasViewSkeleton /> }
);

function RoomTabCanvasIcon({ canvas }: { canvas: Canvas }) {
  return canvas.icon ? (
    <Twemoji className="size-4 shrink-0">{canvas.icon}</Twemoji>
  ) : (
    <IconLayoutBoard />
  );
}

/**
 * The `+` after the tabs, styled like the composer's attach button. It adds a canvas to the room and opens it.
 * Only people who can post see it.
 */
function RoomTabsAddMenu({
  roomId,
  onCreated,
}: {
  roomId: string;
  onCreated: (canvasId: string) => void;
}) {
  const { data: room } = useQuery(roomQuery(roomId));
  const workspaceRole = useWorkspaceRole();
  const create = useCreateCanvas();

  if (!room || !canChannel('post', workspaceRole, room)) return null;
  const label = room.kind === 'dm' ? 'Add to conversation' : 'Add to channel';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={label}
                  disabled={create.isPending}
                  className="group text-muted-foreground hover:text-foreground mb-1 shrink-0 translate-y-0.5 rounded-full"
                />
              }
            />
          }
        >
          <IconPlus className="size-4 transition-[rotate] duration-200 ease-out group-aria-expanded:rotate-135" />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() =>
            create.mutate(
              { roomId },
              {
                onSuccess: (canvas) => onCreated(canvas.id),
                onError: (error) => toast.error(error.message),
              }
            )
          }
        >
          <IconLayoutBoard data-slot="icon" />
          Canvas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PREFETCH_DWELL_MS = 120;

function warmCanvasChunks() {
  void import('@/features/canvases/components/canvas-view').catch(() => {});
  void import('@/features/canvases/components/canvas-editor').catch(() => {});
}

/**
 * Messages, then one tab per canvas, then `+`, directly under a channel's or DM's header. Messages stays mounted,
 * so switching back from a canvas does not reload the stream or lose scroll position.
 */
export function RoomTabs({
  roomId,
  banner,
  children,
}: {
  roomId: string;
  /** Optional banner rendered below the tabs bar, such as an archived channel notice. */
  banner?: ReactNode;
  /** The room's messages. */
  children: ReactNode;
}) {
  const [tab, setTab] = useQueryState('tab', roomTabParam);
  const queryClient = useQueryClient();
  const activeRoomRef = useRef<string | null>(roomId);
  const prefetchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const canvases = useQuery(roomCanvasesQuery(roomId));
  // A failed refresh keeps the tabs it already had.
  let ids: RoomCanvasIds = canvases.isError ? 'failed' : 'pending';
  if (canvases.data) ids = canvases.data.map((canvas) => canvas.id);
  const active = resolveRoomTab(tab, ids);
  const prefetchTarget = prefetchTargetCanvasId(tab, active);
  const validIds = Array.isArray(ids) ? ids : null;
  const [mountedState, setMountedState] = useState<{
    roomId: string;
    ids: string[];
  }>({ roomId, ids: [] });
  const mountedCanvases = updateMountedCanvasTabs(
    mountedState.roomId === roomId ? mountedState.ids : [],
    active,
    validIds
  );
  const handleDeleted = (deletedId: string) => {
    // Guard against both unmount/room change and pre-effect URL navigation before touching `?tab=`.
    if (
      activeRoomRef.current !== roomId ||
      window.location.pathname.split('/').at(-1) !== roomId
    ) {
      return;
    }
    const currentTab = new URLSearchParams(window.location.search).get('tab');
    if (currentTab !== deletedId && currentTab !== 'canvas') return;
    void setTab(null);
  };
  const cancelPrefetch = () => {
    clearTimeout(prefetchTimer.current);
  };
  const prefetchCanvas = (canvasId: string) => {
    warmCanvasChunks();
    clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => {
      void queryClient.prefetchQuery(canvasQuery(canvasId));
    }, PREFETCH_DWELL_MS);
  };

  useEffect(() => {
    activeRoomRef.current = roomId;
    return () => {
      activeRoomRef.current = null;
    };
  }, [roomId]);

  useEffect(() => cancelPrefetch, []);

  useEffect(() => {
    setMountedState((current) => {
      const prev = current.roomId === roomId ? current.ids : [];
      const next = updateMountedCanvasTabs(
        prev,
        active,
        canvases.data ? canvases.data.map((canvas) => canvas.id) : null
      );
      if (
        current.roomId === roomId &&
        next.length === prev.length &&
        next.every((id, index) => id === prev[index])
      ) {
        return current;
      }
      return { roomId, ids: next };
    });
  }, [roomId, active, canvases.data]);

  useEffect(() => {
    // Start canvases.get and warm the canvas chunks alongside roomCanvasesQuery on direct ?tab=<canvasId> links.
    if (!prefetchTarget) return;
    warmCanvasChunks();
    void queryClient.prefetchQuery(canvasQuery(prefetchTarget));
  }, [prefetchTarget, queryClient]);

  return (
    <Tabs
      value={active ?? tab}
      onValueChange={(next) => void setTab(next === 'messages' ? null : next)}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="flex shrink-0 items-center gap-1 border-b px-4">
        <TabsList variant="line" aria-label="Conversation views">
          <TabsTrigger value="messages" className="h-10 px-2 after:bottom-1!">
            <IconMessageCircle />
            Messages
          </TabsTrigger>
          {canvases.data?.map((canvas) => (
            <TabsTrigger
              key={canvas.id}
              value={canvas.id}
              onPointerEnter={() => prefetchCanvas(canvas.id)}
              onPointerLeave={cancelPrefetch}
              onFocus={() => prefetchCanvas(canvas.id)}
              onBlur={cancelPrefetch}
              className="h-10 max-w-48 px-2 after:bottom-1!"
            >
              <RoomTabCanvasIcon canvas={canvas} />
              <span className="truncate">{canvas.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <RoomTabsAddMenu
          roomId={roomId}
          onCreated={(canvasId) => void setTab(canvasId)}
        />
      </div>

      {banner}

      <TabsContent
        value="messages"
        keepMounted
        className="flex min-h-0 flex-col data-hidden:hidden"
      >
        {children}
      </TabsContent>

      {mountedCanvases.map((canvasId) => (
        <TabsContent
          key={canvasId}
          value={canvasId}
          keepMounted
          className="flex min-h-0 flex-col data-hidden:hidden"
        >
          <CanvasViewById
            canvasId={canvasId}
            expectedRoomId={roomId}
            active={active === canvasId}
            onDeleted={() => handleDeleted(canvasId)}
          />
        </TabsContent>
      ))}

      {active === null && tab !== 'messages' && (
        <TabsContent value={tab} className="flex min-h-0 flex-col">
          <CanvasViewSkeleton />
        </TabsContent>
      )}
    </Tabs>
  );
}
