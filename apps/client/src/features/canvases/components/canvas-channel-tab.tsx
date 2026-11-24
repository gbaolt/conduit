'use client';

import { canChannel } from '@conduit/contract';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@conduit/ui/components/tabs';
import { useQuery } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { useCreateCanvas } from '@/services/canvases/hooks';
import { channelCanvasQuery } from '@/services/canvases/queries';
import { roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { CanvasView, CanvasViewSkeleton, CanvasViewState } from './canvas-view';

const TABS = ['messages', 'canvas'] as const;

/** `?tab=canvas` opens the channel's canvas. Messages is the default, so it leaves the URL clean. */
export const canvasChannelTabParam =
  parseAsStringLiteral(TABS).withDefault('messages');

/** The channel's canvas, or a centred prompt to start it. */
export function CanvasChannelTab({ roomId }: { roomId: string }) {
  const canvas = useQuery(channelCanvasQuery(roomId));
  const { data: channel } = useQuery(roomQuery(roomId));
  const workspaceRole = useWorkspaceRole();
  const create = useCreateCanvas();

  if (canvas.isPending) return <CanvasViewSkeleton />;
  if (canvas.isError) {
    return (
      <CanvasViewState
        failed
        title="Couldn't load the canvas"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void canvas.refetch() }}
      />
    );
  }
  if (canvas.data) {
    return (
      <CanvasView
        canvas={canvas.data}
        onDeleted={() => void canvas.refetch()}
      />
    );
  }

  const canCreate = channel && canChannel('post', workspaceRole, channel);
  return (
    <CanvasViewState
      title="No canvas yet"
      description={
        canCreate
          ? 'Keep notes, plans, and checklists beside this channel’s messages.'
          : 'Nobody has started this channel’s canvas.'
      }
      action={
        canCreate
          ? {
              label: 'Create canvas',
              primary: true,
              onClick: () =>
                create.mutate(
                  { roomId },
                  { onError: (error) => toast.error(error.message) }
                ),
            }
          : undefined
      }
    />
  );
}

/** Messages and Canvas, directly under the channel header. Messages stays mounted, so it keeps its scroll. */
export function CanvasChannelTabs({
  roomId,
  children,
}: {
  roomId: string;
  /** The channel's messages. */
  children: ReactNode;
}) {
  const [tab, setTab] = useQueryState('tab', canvasChannelTabParam);

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => void setTab(next)}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="shrink-0 border-b px-2">
        <TabsList variant="line" aria-label="Channel views">
          <TabsTrigger
            value="messages"
            className="h-full flex-none translate-y-1 px-2 after:bottom-0!"
          >
            Messages
          </TabsTrigger>
          <TabsTrigger
            value="canvas"
            className="h-full flex-none translate-y-1 px-2 after:bottom-0!"
          >
            Canvas
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="messages"
        keepMounted
        className="flex min-h-0 flex-col data-hidden:hidden"
      >
        {children}
      </TabsContent>
      <TabsContent value="canvas" className="flex min-h-0 flex-col">
        {tab === 'canvas' && <CanvasChannelTab roomId={roomId} />}
      </TabsContent>
    </Tabs>
  );
}
