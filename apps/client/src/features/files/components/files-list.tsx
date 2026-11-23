'use client';

import { fileKind, formatFileSize, type ListedFile } from '@conduit/contract';
import { Button, buttonVariants } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
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
  IconArrowUpRight,
  IconFilterOff,
  IconFolder,
  type TablerIcon,
} from '@tabler/icons-react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { type ReactNode, useMemo, useState } from 'react';

import { FileKindIcon } from '@/components/file-kind-icon';
import { FileViewer } from '@/components/file-viewer';
import { useRoomName } from '@/features/messages/hooks/use-room-name';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { filesQuery, fileUrlsQuery } from '@/services/files/queries';

import { filesParams } from '../lib/files-params';

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const yearFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const fullFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
});

const sharedOn = (date: Date) =>
  (date.getFullYear() === new Date().getFullYear()
    ? dayFormat
    : yearFormat
  ).format(date);

/** The message that carried the file, in its conversation, or in its thread panel for a reply. */
function messageHref(file: ListedFile): Route {
  const base = `${file.room.kind === 'dm' ? '/dms' : '/channels'}/${file.room.id}`;
  const params = new URLSearchParams();
  if (file.parentId) params.set('thread', file.parentId);
  params.set('message', file.messageId);
  return `${base}?${params}` as Route;
}

/** "#design", or the other person's name for a DM, which only the viewer's DM list knows. */
function FileRoom({ file }: { file: ListedFile }) {
  if (file.room.kind === 'channel') return <>#{file.room.name}</>;
  return <FileDmName roomId={file.room.id} />;
}

function FileDmName({ roomId }: { roomId: string }) {
  const { title } = useRoomName(roomId);
  return title ? (
    <>{title}</>
  ) : (
    <Skeleton className="inline-block h-3.5 w-20" />
  );
}

/** The file's name: it opens the viewer when the browser can show the file, and downloads it otherwise. */
function FileName({ file, onOpen }: { file: ListedFile; onOpen: () => void }) {
  const content = (
    <>
      <FileKindIcon contentType={file.contentType} data-icon="inline-start" />
      <span className="truncate">{file.name}</span>
    </>
  );
  const className =
    'h-auto max-w-full min-w-0 justify-start px-1.5 py-1 -mx-1.5 font-medium';

  if (fileKind(file.contentType) === 'other') {
    return <FileDownloadName file={file} className={className} />;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      title={file.name}
      className={className}
      onClick={onOpen}
    >
      {content}
    </Button>
  );
}

/** A file the browser should not open in place: its name signs a link on demand and downloads it. */
function FileDownloadName({
  file,
  className,
}: {
  file: ListedFile;
  className: string;
}) {
  const [wanted, setWanted] = useState(false);
  const { data: urls } = useQuery({
    ...fileUrlsQuery([file.id]),
    enabled: wanted,
  });
  const url = urls?.get(file.id)?.downloadUrl;

  return (
    <a
      href={url}
      download={file.name}
      title={file.name}
      className={buttonVariants({ variant: 'ghost', size: 'sm', className })}
      onPointerEnter={() => setWanted(true)}
      onFocus={() => setWanted(true)}
      onClick={(event) => {
        if (!url) event.preventDefault();
      }}
    >
      <FileKindIcon contentType={file.contentType} data-icon="inline-start" />
      <span className="truncate">{file.name}</span>
    </a>
  );
}

function FileRow({ file, onOpen }: { file: ListedFile; onOpen: () => void }) {
  return (
    <TableRow>
      <TableCell className="max-w-0 py-2 ps-2 sm:ps-4">
        <FileName file={file} onOpen={onOpen} />
        <p className="text-muted-foreground truncate px-0 text-xs sm:hidden">
          <FileRoom file={file} /> · {file.uploader.name} ·{' '}
          {formatFileSize(file.size)}
        </p>
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-48 truncate sm:table-cell">
        <FileRoom file={file} />
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-48 truncate md:table-cell">
        {file.uploader.name}
      </TableCell>
      <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
        {formatFileSize(file.size)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        <time
          dateTime={file.createdAt.toISOString()}
          title={fullFormat.format(file.createdAt)}
        >
          {sharedOn(file.createdAt)}
        </time>
      </TableCell>
      <TableCell className="pe-2 text-right sm:pe-4">
        <Link
          href={messageHref(file)}
          aria-label={`Jump to the message with ${file.name}`}
          title="Jump to message"
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <IconArrowUpRight />
        </Link>
      </TableCell>
    </TableRow>
  );
}

function FilesTableHeader() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="ps-2 text-xs font-normal sm:ps-4">Name</TableHead>
        <TableHead className="hidden w-48 text-xs font-normal sm:table-cell">
          Shared in
        </TableHead>
        <TableHead className="hidden w-48 text-xs font-normal md:table-cell">
          Shared by
        </TableHead>
        <TableHead className="hidden w-24 text-right text-xs font-normal sm:table-cell">
          Size
        </TableHead>
        <TableHead className="w-16 text-right text-xs font-normal sm:w-28">
          Date
        </TableHead>
        <TableHead className="w-10 pe-2 sm:w-12 sm:pe-4">
          <span className="sr-only">Message</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

const SKELETON_WIDTHS = ['w-56', 'w-40', 'w-64', 'w-32', 'w-48', 'w-44'];

/** Rows the height of loaded ones, so nothing moves when the files arrive. */
export function FilesListSkeleton() {
  return (
    <div role="status" aria-label="Loading files" className="px-2 sm:px-4">
      <Table>
        <FilesTableHeader />
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
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
              <TableCell className="pe-4" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FilesState({
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

/** Every sent file the viewer can read, newest first, narrowed by the toolbar's filters. */
export function FilesList() {
  const [{ room, person, type, q }, setParams] = useQueryStates(filesParams);
  const name = useDebouncedValue(q, 250);
  const filtered = Boolean(room || person || type || q.trim());
  const {
    data,
    isPending,
    isError,
    isPlaceholderData,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...filesQuery({
      roomId: room,
      uploaderId: person,
      kinds: type ? [type] : undefined,
      name,
    }),
    placeholderData: keepPreviousData,
  });
  const files = useMemo(
    () => data?.pages.flatMap((page) => page.files) ?? [],
    [data]
  );
  if (isPending) return <FilesListSkeleton />;
  if (isError) {
    return (
      <FilesState
        icon={IconAlertTriangle}
        title="Couldn't load files"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }
  if (files.length === 0) {
    return filtered ? (
      <FilesState
        icon={IconFilterOff}
        title="No matching files"
        description="No file you can see matches these filters."
        action={{
          label: 'Clear filters',
          onClick: () =>
            void setParams({ room: null, person: null, type: null, q: null }),
        }}
      />
    ) : (
      <FilesState
        icon={IconFolder}
        title="No files yet"
        description="Files shared in the channels and DMs you can read show up here."
      />
    );
  }

  return (
    <FilesTable files={files} busy={isPlaceholderData}>
      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load older
        </Button>
      )}
    </FilesTable>
  );
}

/** Files as the Files page shows them, each name opening the viewer. `children` sit under the table. */
export function FilesTable({
  files,
  busy = false,
  children,
}: {
  files: ListedFile[];
  busy?: boolean;
  children?: ReactNode;
}) {
  const [viewing, setViewing] = useState<ListedFile | null>(null);
  const { data: urls } = useQuery({
    ...fileUrlsQuery(viewing ? [viewing.id] : []),
    enabled: viewing !== null,
  });

  return (
    <div className="px-2 sm:px-4">
      <Table
        aria-busy={busy}
        className={cn('transition-opacity', busy && 'opacity-60')}
      >
        <caption className="sr-only">Files</caption>
        <FilesTableHeader />
        <TableBody>
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              onOpen={() => setViewing(file)}
            />
          ))}
        </TableBody>
      </Table>
      {children}
      <FileViewer
        file={viewing}
        url={viewing ? urls?.get(viewing.id) : undefined}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
