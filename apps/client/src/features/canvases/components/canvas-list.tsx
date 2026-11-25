'use client';

import { type Canvas, CANVAS_TITLE_MAX } from '@conduit/contract';
import { Button, buttonVariants } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@conduit/ui/components/table';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconAlertTriangle,
  IconFilterOff,
  IconHash,
  IconLayoutBoard,
  IconPlus,
  IconSearch,
  IconUsers,
  IconX,
  type TablerIcon,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useCreateCanvas } from '@/services/canvases/hooks';
import { canvasesQuery } from '@/services/canvases/queries';

const SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'channel', label: 'Channel' },
  { value: 'shared', label: 'Shared with me' },
] as const;

/** `/canvases?scope=shared&q=plan`. */
const canvasListParams = {
  scope: parseAsStringLiteral(SCOPES.map((scope) => scope.value)).withDefault(
    'all'
  ),
  q: parseAsString.withDefault(''),
};

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const fullFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
});

/** A channel canvas opens in its channel's Canvas tab, and a standalone one on its own page. */
function hrefOf(canvas: Canvas): Route {
  return (
    canvas.roomId
      ? `/channels/${canvas.roomId}?tab=canvas`
      : `/canvases/${canvas.id}`
  ) as Route;
}

/** The page's one primary action: start a standalone canvas and open it. */
export function CanvasListNewButton() {
  const router = useRouter();
  const create = useCreateCanvas();

  return (
    <StatusButton
      size="sm"
      status={create.isPending ? 'loading' : 'idle'}
      onClick={() =>
        create.mutate(
          {},
          {
            onSuccess: (canvas) =>
              router.push(`/canvases/${canvas.id}` as Route),
            onError: (error) => toast.error(error.message),
          }
        )
      }
    >
      <IconPlus data-icon="inline-start" />
      New canvas
    </StatusButton>
  );
}

/** Narrows the list by title. It rests as a button beside the scope and opens into a field. */
function CanvasListSearch() {
  const [{ q }, setParams] = useQueryStates(canvasListParams);
  const [opened, setOpened] = useState(false);

  if (!opened && !q) {
    return (
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Search canvases"
        onClick={() => setOpened(true)}
      >
        <IconSearch />
      </Button>
    );
  }

  const clear = () => {
    void setParams({ q: null });
    setOpened(false);
  };

  return (
    <InputGroup className="h-8 w-40 sm:w-56">
      <InputGroupAddon>
        <IconSearch />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label="Search canvases"
        placeholder="Search canvases"
        autoFocus={opened}
        maxLength={CANVAS_TITLE_MAX}
        value={q}
        onChange={(event) => void setParams({ q: event.target.value })}
        onBlur={() => {
          if (!q) setOpened(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            clear();
          }
        }}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={clear}
          >
            <IconX />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

export function CanvasListToolbar() {
  const [{ scope }, setParams] = useQueryStates(canvasListParams);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-4">
      <Select
        items={SCOPES}
        value={scope}
        onValueChange={(next) =>
          void setParams({ scope: next === 'all' ? null : next })
        }
      >
        <SelectTrigger size="sm" aria-label="Show">
          <span className="text-muted-foreground">Show</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          {SCOPES.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CanvasListSearch />
    </div>
  );
}

export function CanvasListToolbarSkeleton() {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 py-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="size-8" />
    </div>
  );
}

function CanvasListHeader() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="ps-2 text-xs font-normal sm:ps-4">
          Title
        </TableHead>
        <TableHead className="hidden w-48 text-xs font-normal sm:table-cell">
          In
        </TableHead>
        <TableHead className="hidden w-48 text-xs font-normal md:table-cell">
          Last edited by
        </TableHead>
        <TableHead className="w-20 pe-2 text-right text-xs font-normal sm:w-28 sm:pe-4">
          Updated
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function CanvasListPlace({ canvas }: { canvas: Canvas }) {
  return canvas.roomId ? (
    <>
      <IconHash className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{canvas.roomName}</span>
    </>
  ) : (
    <>
      <IconUsers className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">Shared</span>
    </>
  );
}

function CanvasListRow({ canvas }: { canvas: Canvas }) {
  return (
    <TableRow>
      <TableCell className="max-w-0 py-2 ps-2 sm:ps-4">
        <Link
          href={hrefOf(canvas)}
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className:
              '-mx-1.5 h-auto max-w-full justify-start px-1.5 py-1 font-medium',
          })}
        >
          <IconLayoutBoard data-icon="inline-start" />
          <span className="truncate">{canvas.title}</span>
        </Link>
        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs sm:hidden">
          <CanvasListPlace canvas={canvas} />
        </p>
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-48 sm:table-cell">
        <span className="flex items-center gap-1">
          <CanvasListPlace canvas={canvas} />
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-48 truncate md:table-cell">
        {canvas.updatedByName ?? '—'}
      </TableCell>
      <TableCell className="text-muted-foreground pe-2 text-right tabular-nums sm:pe-4">
        <time
          dateTime={canvas.updatedAt.toISOString()}
          title={fullFormat.format(canvas.updatedAt)}
        >
          {dayFormat.format(canvas.updatedAt)}
        </time>
      </TableCell>
    </TableRow>
  );
}

const SKELETON_WIDTHS = ['w-56', 'w-40', 'w-64', 'w-32', 'w-48'];

export function CanvasListSkeleton() {
  return (
    <div role="status" aria-label="Loading canvases" className="px-2 sm:px-4">
      <Table>
        <CanvasListHeader />
        <TableBody>
          {SKELETON_WIDTHS.map((width) => (
            <TableRow key={width} className="hover:bg-transparent">
              <TableCell className="py-2 ps-4">
                <div className="flex h-8 items-center gap-2">
                  <Skeleton className="size-4" />
                  <Skeleton className={cn('h-4', width)} />
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="pe-4">
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CanvasListState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: TablerIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

/** Every canvas the viewer can read, in channels and shared with them, recently updated first. */
export function CanvasList() {
  const [{ scope, q }, setParams] = useQueryStates(canvasListParams);
  const canvases = useQuery(canvasesQuery(scope));
  const needle = q.trim().toLowerCase();

  if (canvases.isPending) return <CanvasListSkeleton />;
  if (canvases.isError) {
    return (
      <CanvasListState
        icon={IconAlertTriangle}
        title="Couldn't load canvases"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void canvases.refetch() }}
      />
    );
  }

  const shown = canvases.data.filter((canvas) =>
    canvas.title.toLowerCase().includes(needle)
  );
  if (shown.length === 0) {
    return scope !== 'all' || needle ? (
      <CanvasListState
        icon={IconFilterOff}
        title="No matching canvases"
        description="No canvas you can open matches this search."
        action={{
          label: 'Clear filters',
          onClick: () => void setParams({ scope: null, q: null }),
        }}
      />
    ) : (
      <CanvasListState
        icon={IconLayoutBoard}
        title="No canvases yet"
        description="Canvases in your channels and ones shared with you show up here."
      />
    );
  }

  return (
    <div className="px-2 sm:px-4">
      <Table>
        <caption className="sr-only">Canvases</caption>
        <CanvasListHeader />
        <TableBody>
          {shown.map((canvas) => (
            <CanvasListRow key={canvas.id} canvas={canvas} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
