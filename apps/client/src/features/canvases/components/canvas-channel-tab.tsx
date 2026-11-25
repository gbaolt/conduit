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
import { parseAsString, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { useCreateCanvas } from '@/services/canvases/hooks';
import { channelCanvasesQuery } from '@/services/canvases/queries';
import { roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { type ChannelCanvasIds, resolveChannelTab } from '../lib/channel-tab';
import { CanvasViewById, CanvasViewSkeleton } from './canvas-view';

/** `?tab=` holds `messages` or a canvas id. Messages is the default, so it leaves the URL clean. */
export const canvasChannelTabParam = parseAsString.withDefault('messages');

const TRIGGER_CLASS = 'h-full flex-none translate-y-1 px-2 after:bottom-0!';

function CanvasTabIcon({ canvas }: { canvas: Canvas }) {
  return canvas.icon ? (
    <Twemoji className="size-4 shrink-0">{canvas.icon}</Twemoji>
  ) : (
    <IconLayoutBoard />
  );
}

/** The `+` after the tabs. It adds a canvas to the channel and opens it. Only people who can post see it. */
function CanvasChannelAddMenu({
  roomId,
  onCreated,
}: {
  roomId: string;
  onCreated: (canvasId: string) => void;
}) {
  const { data: channel } = useQuery(roomQuery(roomId));
  const workspaceRole = useWorkspaceRole();
  const create = useCreateCanvas();

  if (!channel || !canChannel('post', workspaceRole, channel)) return null;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Add to channel"
                  disabled={create.isPending}
                  className="shrink-0 translate-y-0.5"
                />
              }
            />
          }
        >
          <IconPlus />
        </TooltipTrigger>
        <TooltipContent>Add to channel</TooltipContent>
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
 * Messages, then one tab per canvas, then `+`, directly under the channel header. Messages stays mounted, so it
 * keeps its scroll.
 */
export function CanvasChannelTabs({
  roomId,
  banner,
  children,
}: {
  roomId: string;
  /** Optional banner rendered below the tabs bar, such as an archived channel notice. */
  banner?: ReactNode;
  /** The channel's messages. */
  children: ReactNode;
}) {
  const [tab, setTab] = useQueryState('tab', canvasChannelTabParam);
  const canvases = useQuery(channelCanvasesQuery(roomId));
  // A failed refresh keeps the tabs it already had.
  let ids: ChannelCanvasIds = canvases.isError ? 'failed' : 'pending';
  if (canvases.data) ids = canvases.data.map((canvas) => canvas.id);
  const active = resolveChannelTab(tab, ids);
  const showMessages = () => void setTab(null);

  return (
    <Tabs
      value={active ?? tab}
      onValueChange={(next) => void setTab(next === 'messages' ? null : next)}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="flex shrink-0 items-center gap-1 border-b px-2">
        <div className="min-w-0 overflow-x-auto">
          <TabsList variant="line" aria-label="Channel views">
            <TabsTrigger value="messages" className={TRIGGER_CLASS}>
              <IconMessageCircle />
              Messages
            </TabsTrigger>
            {canvases.data?.map((canvas) => (
              <TabsTrigger
                key={canvas.id}
                value={canvas.id}
                className={`${TRIGGER_CLASS} max-w-48`}
              >
                <CanvasTabIcon canvas={canvas} />
                <span className="truncate">{canvas.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <CanvasChannelAddMenu
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
