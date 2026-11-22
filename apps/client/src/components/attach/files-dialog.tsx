'use client';

import {
  canAttachToRoom,
  FILE_KINDS,
  type FileKind,
  formatFileSize,
  type ListedFile,
} from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import { ScrollArea } from '@conduit/ui/components/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { Spinner } from '@conduit/ui/components/spinner';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@conduit/ui/components/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconCheck,
  IconFolder,
  IconLock,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { FileKindIcon } from '@/components/file-kind-icon';
import { useRoomName } from '@/features/messages/hooks/use-room-name';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fileCountsQuery, filesQuery } from '@/services/files/queries';

const KIND_LABELS: Record<FileKind, string> = {
  image: 'Images',
  video: 'Videos',
  pdf: 'PDFs',
  text: 'Text and code',
  other: 'Other',
};
const ALL = 'all' as const;
const NOT_SHAREABLE =
  'Files from private channels and DMs stay where they were shared.';

type Owner = 'all' | 'others' | 'me';
const OWNERS: { value: Owner; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'others', label: 'Shared with you' },
  { value: 'me', label: 'Created by you' },
];

/** Where the file was shared: "#design" with a lock when private, or the other person's name for a DM. */
function FileWhere({ file }: { file: ListedFile }) {
  const { title } = useRoomName(file.room.id);
  if (file.room.kind === 'dm') return <>{title || 'Direct message'}</>;
  return (
    <span className="inline-flex min-w-0 items-center gap-0.5">
      {file.room.visibility === 'private' && (
        <IconLock aria-label="Private" className="size-3 shrink-0" />
      )}
      <span className="truncate">#{file.room.name}</span>
    </span>
  );
}

/** One file. Selectable unless it can't join this message, in which case it says why. */
function FileRow({
  file,
  selected,
  reason,
  onToggle,
}: {
  file: ListedFile;
  selected: boolean;
  reason: string | null;
  onToggle: () => void;
}) {
  const reasonId = `${file.id}-reason`;
  const row = (
    <Button
      type="button"
      variant="ghost"
      data-file-row=""
      aria-pressed={selected}
      aria-disabled={reason ? true : undefined}
      aria-describedby={reason ? reasonId : undefined}
      className={cn(
        'h-14 w-full justify-start gap-3 rounded-sm px-2 text-left font-normal',
        selected && 'bg-accent',
        reason && 'cursor-not-allowed opacity-50 hover:bg-transparent'
      )}
      onClick={() => !reason && onToggle()}
    >
      <span className="bg-muted text-muted-foreground relative flex size-10 shrink-0 items-center justify-center rounded-sm">
        <FileKindIcon contentType={file.contentType} className="size-5" />
        {selected && (
          <span className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full">
            <IconCheck className="size-3" />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm leading-5">{file.name}</span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatFileSize(file.size)}
          </span>
        </span>
        <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs leading-4">
          <span className="truncate">{file.uploader.name}</span>
          <span aria-hidden>·</span>
          <FileWhere file={file} />
          <span aria-hidden>·</span>
          <span className="shrink-0">
            {formatDistanceToNow(file.createdAt, { addSuffix: true })}
          </span>
        </span>
      </span>
      {reason && (
        <span id={reasonId} className="sr-only">
          Unavailable. {reason}
        </span>
      )}
    </Button>
  );
  if (!reason) return row;
  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function FileRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5 p-1">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-14 items-center gap-3 px-2">
          <Skeleton className="size-10 shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Moves focus between rows with the arrow keys. Enter inserts what is selected. */
function onListKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  insert: () => void
) {
  const rows = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[data-file-row]'),
  ];
  const index = rows.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'Enter') {
    event.preventDefault();
    insert();
    return;
  }
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (!step || index === -1) return;
  event.preventDefault();
  rows[Math.max(0, Math.min(rows.length - 1, index + step))]?.focus();
}

/**
 * Picks files already shared in the workspace, for the composer to attach. A file that can't join `targetRoomId`
 * stays listed, dimmed, with the reason. Without `targetRoomId`, as in Ask, every listed file can be picked.
 */
export function FilesDialog({
  open,
  onOpenChange,
  kinds = FILE_KINDS,
  roomKind,
  targetRoomId,
  max,
  onInsert,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The kinds this composer accepts. The rail offers only these. */
  kinds?: readonly FileKind[];
  roomKind?: 'channel';
  targetRoomId?: string;
  /** How many files may still join. */
  max: number;
  onInsert: (files: ListedFile[]) => Promise<void> | void;
  onUpload: () => void;
}) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<FileKind | typeof ALL>(ALL);
  const [owner, setOwner] = useState<Owner>('all');
  const [selected, setSelected] = useState<ListedFile[]>([]);
  const [inserting, setInserting] = useState(false);
  const name = useDebouncedValue(search, 250);
  const filters = {
    name,
    roomKind,
    owner: owner === 'all' ? undefined : owner,
  };
  const { data: counts } = useQuery({
    ...fileCountsQuery(filters),
    enabled: open,
  });
  const list = useInfiniteQuery({
    ...filesQuery({
      ...filters,
      kinds: kind === ALL ? [...kinds] : [kind],
    }),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const files = list.data?.pages.flatMap((page) => page.files) ?? [];
  const end = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  useEffect(() => {
    const node = end.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, files.length]);

  const total = kinds.reduce((sum, item) => sum + (counts?.[item] ?? 0), 0);
  const rail: { value: FileKind | typeof ALL; label: string; count: number }[] =
    [
      { value: ALL, label: 'All files', count: total },
      ...kinds.map((item) => ({
        value: item,
        label: KIND_LABELS[item],
        count: counts?.[item] ?? 0,
      })),
    ];
  const reasonOf = (file: ListedFile) =>
    targetRoomId && !canAttachToRoom(file, targetRoomId) ? NOT_SHAREABLE : null;
  const isSelected = (file: ListedFile) =>
    selected.some((item) => item.id === file.id);
  const toggle = (file: ListedFile) =>
    setSelected((current) => {
      if (current.some((item) => item.id === file.id)) {
        return current.filter((item) => item.id !== file.id);
      }
      return current.length < max ? [...current, file] : current;
    });

  const close = (next: boolean) => {
    if (inserting) return;
    if (!next) setSelected([]);
    onOpenChange(next);
  };
  const insert = async () => {
    if (selected.length === 0 || inserting) return;
    setInserting(true);
    try {
      await onInsert(selected);
    } finally {
      setInserting(false);
    }
    setSelected([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex h-[min(88vh,640px)] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Files</DialogTitle>
        </DialogHeader>
        <InputGroup>
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search files"
            placeholder="Search files"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
          <nav
            aria-label="File types"
            className="hidden w-44 shrink-0 flex-col gap-0.5 sm:flex"
          >
            {rail.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={kind === item.value}
                className={cn(
                  'justify-between font-normal',
                  kind === item.value && 'bg-accent font-medium'
                )}
                onClick={() => setKind(item.value)}
              >
                {item.label}
                <span className="text-muted-foreground text-xs tabular-nums">
                  {item.count}
                </span>
              </Button>
            ))}
          </nav>
          <Select
            items={rail.map(({ value, label }) => ({ value, label }))}
            value={kind}
            onValueChange={(next) => next && setKind(next as FileKind)}
          >
            <SelectTrigger
              size="sm"
              aria-label="File type"
              className="sm:hidden"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {rail.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label} · {item.count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Who shared it"
              value={[owner]}
              onValueChange={(next) => next[0] && setOwner(next[0] as Owner)}
            >
              {OWNERS.map((item) => (
                <ToggleGroupItem key={item.value} value={item.value}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              {list.isPending && <FileRowsSkeleton />}
              {!list.isPending && files.length === 0 && (
                <Empty className="h-full min-h-60">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconFolder />
                    </EmptyMedia>
                    <EmptyTitle>No files</EmptyTitle>
                    <EmptyDescription>
                      {name
                        ? `Nothing matches "${name}".`
                        : 'Nothing shared here yet.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              {files.length > 0 && (
                <div
                  aria-label="Files"
                  className="flex flex-col gap-0.5 p-1"
                  onKeyDown={(event) =>
                    onListKeyDown(event, () => void insert())
                  }
                >
                  {files.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      selected={isSelected(file)}
                      reason={reasonOf(file)}
                      onToggle={() => toggle(file)}
                    />
                  ))}
                  <div ref={end} />
                  {isFetchingNextPage && <FileRowsSkeleton rows={2} />}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="flex-row items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={onUpload}>
            <IconUpload data-icon="start" />
            Upload
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0 || inserting}
            onClick={() => void insert()}
          >
            {inserting && <Spinner data-icon="inline-start" />}
            {selected.length > 1 ? `Insert ${selected.length} files` : 'Insert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
