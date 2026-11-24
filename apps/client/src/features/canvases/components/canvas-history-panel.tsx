'use client';

import type {
  CanvasVersionSummary,
  CanvasVersionTrigger,
} from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { Sheet, SheetContent } from '@conduit/ui/components/sheet';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { useBroadcastEvent, useEventListener } from '@liveblocks/react';
import { IconDeviceFloppy, IconHistory, IconX } from '@tabler/icons-react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { type KeyboardEvent, type RefObject, useEffect } from 'react';

import { SidePanel } from '@/components/side-panel';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useInvalidateCanvasVersions } from '@/services/canvases/hooks';
import {
  canvasVersionQuery,
  canvasVersionsQuery,
} from '@/services/canvases/queries';

const TRIGGER_LABELS: Record<CanvasVersionTrigger, string> = {
  auto: 'Autosave',
  manual: 'Saved version',
  restore: 'Restored',
  ai_draft: 'AI draft',
};

const savedFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type CanvasHistoryPanelProps = {
  canvasId: string;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The version shown in place of the live canvas, or null for the live canvas. */
  previewId: string | null;
  onPreview: (versionId: string | null) => void;
  onSaveVersion: () => void;
};

function CanvasHistoryPanelItem({
  version,
  active,
  onSelect,
}: {
  version: CanvasVersionSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <Button
        variant="ghost"
        data-version-id={version.id}
        data-active={active || undefined}
        aria-current={active || undefined}
        onClick={onSelect}
        className="data-active:bg-muted dark:text-muted-foreground dark:data-active:text-foreground h-auto w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left font-normal whitespace-normal transition-none dark:data-active:bg-transparent"
      >
        <span className="line-clamp-2 text-sm font-medium">
          {version.label ?? TRIGGER_LABELS[version.trigger]}
        </span>
        <span className="text-muted-foreground flex w-full gap-1 text-xs">
          <time
            dateTime={version.createdAt.toISOString()}
            className="shrink-0 tabular-nums"
          >
            {savedFormat.format(version.createdAt)}
          </time>
          {version.author && (
            <span className="truncate">· {version.author.name}</span>
          )}
        </span>
      </Button>
    </li>
  );
}

function CanvasHistoryPanelSkeleton() {
  return (
    <div role="status" aria-label="Loading versions" className="space-y-4 p-4">
      {['w-2/5', 'w-3/5', 'w-1/2'].map((width) => (
        <div key={width} className="space-y-1.5">
          <Skeleton className={`h-4 ${width}`} />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

function CanvasHistoryPanelList({
  canvasId,
  open,
  onOpenChange,
  previewId,
  onPreview,
}: CanvasHistoryPanelProps) {
  const queryClient = useQueryClient();
  const versions = useInfiniteQuery({
    ...canvasVersionsQuery(canvasId),
    enabled: open,
  });

  if (versions.isPending) return <CanvasHistoryPanelSkeleton />;
  if (versions.isError) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Couldn&apos;t load versions.{' '}
        <Button
          variant="link"
          size="xs"
          onClick={() => void versions.refetch()}
        >
          Retry
        </Button>
      </p>
    );
  }
  const items = versions.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconHistory />
          </EmptyMedia>
          <EmptyTitle>No versions yet</EmptyTitle>
          <EmptyDescription>
            A version is kept every few minutes while the canvas changes.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const select = (index: number) => {
    const version = items[index];
    if (!version) return;
    onPreview(version.id);
    // Stepping with the arrows feels instant when the neighbours are already loaded.
    for (const near of [items[index - 1], items[index + 1]]) {
      if (near) {
        void queryClient.prefetchQuery(canvasVersionQuery(canvasId, near.id));
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (previewId) onPreview(null);
      else onOpenChange(false);
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    // From the focused row, so the first arrow press moves off the row the keyboard is on.
    const from = (event.target as HTMLElement).dataset.versionId ?? previewId;
    const current = items.findIndex((item) => item.id === from);
    const next = Math.min(Math.max(current + step, 0), items.length - 1);
    select(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-version-id="${items[next]!.id}"]`)
      ?.focus();
  };

  return (
    <>
      <ul
        aria-label="Versions, newest first"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-0.5 p-2"
      >
        {items.map((version, index) => (
          <CanvasHistoryPanelItem
            key={version.id}
            version={version}
            active={version.id === previewId}
            onSelect={() => select(index)}
          />
        ))}
      </ul>
      {versions.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          disabled={versions.isFetchingNextPage}
          onClick={() => void versions.fetchNextPage()}
          className="mx-2 mb-2"
        >
          Load older versions
        </Button>
      )}
    </>
  );
}

function CanvasHistoryPanelContent(props: CanvasHistoryPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-base font-semibold">History</h2>
        {props.canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={props.onSaveVersion}
            className="ml-auto"
          >
            <IconDeviceFloppy data-icon="inline-start" />
            Save version
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close history"
          onClick={() => props.onOpenChange(false)}
          className={props.canEdit ? undefined : 'ml-auto'}
        >
          <IconX />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <CanvasHistoryPanelList {...props} />
      </div>
    </div>
  );
}

/**
 * The canvas's versions, in the side card from xl up and in a right sheet below it. Below xl a chosen version
 * shows in place of the canvas, so the sheet steps aside while it does.
 */
export function CanvasHistoryPanel(props: CanvasHistoryPanelProps) {
  const docked = useMediaQuery('(min-width: 80rem)');

  if (docked) {
    return (
      props.open && (
        <SidePanel>
          <CanvasHistoryPanelContent {...props} />
        </SidePanel>
      )
    );
  }
  return (
    <Sheet
      open={props.open && props.previewId === null}
      onOpenChange={props.onOpenChange}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-label="History"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <CanvasHistoryPanelContent {...props} />
      </SheetContent>
    </Sheet>
  );
}

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
