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
import { useQuery } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import {
  CanvasViewById,
  CanvasViewSkeleton,
} from '@/features/canvases/components/canvas-view';
import { useCreateCanvas } from '@/services/canvases/hooks';
import { roomCanvasesQuery } from '@/services/canvases/queries';
import { roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import {
  resolveRoomTab,
  type RoomCanvasIds,
  roomTabParam,
} from '../lib/room-tab';

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

/**
 * Messages, then one tab per canvas, then `+`, directly under a channel's or DM's header. Messages stays mounted,
 * so it keeps its scroll.
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
  const canvases = useQuery(roomCanvasesQuery(roomId));
  // A failed refresh keeps the tabs it already had.
  let ids: RoomCanvasIds = canvases.isError ? 'failed' : 'pending';
  if (canvases.data) ids = canvases.data.map((canvas) => canvas.id);
  const active = resolveRoomTab(tab, ids);
  const showMessages = () => void setTab(null);

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

      {active !== 'messages' && (
        <TabsContent value={active ?? tab} className="flex min-h-0 flex-col">
          {active ? (
            <CanvasViewById
              key={active}
              canvasId={active}
              onDeleted={showMessages}
            />
          ) : (
            <CanvasViewSkeleton />
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}
