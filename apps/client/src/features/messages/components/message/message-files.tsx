'use client';

import { fileKind, formatFileSize, type MessageFile } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { cn } from '@conduit/ui/lib/utils';
import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { type CSSProperties, useRef, useState } from 'react';

import { FileKindIcon } from '@/components/file-kind-icon';
import { FileViewer } from '@/components/file-viewer';
import { fileUrlsQuery } from '@/services/files/queries';

const MEDIA_MAX_HEIGHT = 360;
const MEDIA_MAX_WIDTH = 480;
const GRID_MAX = 4;

const cardClass =
  'group/file bg-background flex h-14 w-full max-w-80 min-w-0 items-center gap-2.5 rounded-md border px-2 text-left';
const pressableClass =
  'hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-3 transition-[background-color,scale] duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100';

/** Holds a measured image or video at its own shape, scaled into the preview box, so the log never jumps. */
function mediaBox(file: MessageFile): CSSProperties {
  if (!file.width || !file.height) {
    return { width: 320, aspectRatio: '4 / 3', maxWidth: '100%' };
  }
  const scale = Math.min(
    1,
    MEDIA_MAX_HEIGHT / file.height,
    MEDIA_MAX_WIDTH / file.width
  );
  return {
    width: Math.max(80, Math.round(file.width * scale)),
    aspectRatio: `${file.width} / ${file.height}`,
    maxWidth: '100%',
  };
}

/** One file under a message: its kind, name, and size. A link or a button when there is something to do with it. */
export function MessageFileCard({
  file,
  downloadUrl,
  onPreview,
}: {
  file: MessageFile;
  downloadUrl?: string;
  onPreview?: () => void;
}) {
  const body = (
    <>
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-sm">
        <FileKindIcon contentType={file.contentType} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm leading-5" title={file.name}>
          {file.name}
        </span>
        <span className="text-muted-foreground text-xs leading-4 tabular-nums">
          {formatFileSize(file.size)}
        </span>
      </span>
      {downloadUrl && !onPreview && (
        <IconDownload
          aria-hidden
          className="text-muted-foreground group-hover/file:text-foreground size-4 shrink-0 transition-colors"
        />
      )}
    </>
  );

  if (onPreview) {
    return (
      <Button
        type="button"
        variant="outline"
        aria-label={`Preview ${file.name}, ${formatFileSize(file.size)}`}
        className={cn(cardClass, 'justify-start font-normal')}
        onClick={onPreview}
      >
        {body}
      </Button>
    );
  }
  if (!downloadUrl) return <div className={cardClass}>{body}</div>;

  return (
    <a
      href={downloadUrl}
      download={file.name}
      aria-label={`Download ${file.name}, ${formatFileSize(file.size)}`}
      className={cn(cardClass, pressableClass)}
    >
      {body}
    </a>
  );
}

/** An image in the message. A placeholder holds its shape until the bytes arrive. */
function MessageImage({
  file,
  url,
  style,
  className,
  more = 0,
  onOpen,
  onError,
}: {
  file: MessageFile;
  url: string | undefined;
  style?: CSSProperties;
  className?: string;
  /** Images past the grid, counted over the last tile. */
  more?: number;
  onOpen: () => void;
  onError: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={
        more > 0 ? `Open ${file.name} and ${more} more` : `Open ${file.name}`
      }
      style={style}
      className={cn(
        'border-border relative block h-auto overflow-hidden p-0',
        className
      )}
      onClick={onOpen}
    >
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      {url && (
        <img
          src={url}
          alt={file.name}
          loading="lazy"
          decoding="async"
          className={cn(
            'size-full object-cover transition-opacity duration-200 ease-out motion-reduce:transition-none',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setLoaded(true)}
          onError={onError}
        />
      )}
      {more > 0 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white tabular-nums">
          +{more}
        </span>
      )}
    </Button>
  );
}

/** A video plays in place with the browser's controls, and loads only its first frame until played. */
function MessageVideo({
  file,
  url,
  onError,
}: {
  file: MessageFile;
  url: string | undefined;
  onError: () => void;
}) {
  return (
    <div
      style={mediaBox(file)}
      className="relative overflow-hidden rounded-md border bg-black"
    >
      {url ? (
        <video
          src={url}
          controls
          preload="metadata"
          aria-label={file.name}
          className="size-full"
          onError={onError}
        />
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
    </div>
  );
}

/**
 * The files a sent message carries: images in a grid, videos in place, and a card for every other file.
 * Signs their links once and reuses them until they near expiry. A link that fails to load is signed again, once.
 */
export function MessageFiles({ files }: { files: MessageFile[] }) {
  const { data: urls, refetch } = useQuery({
    ...fileUrlsQuery(files.map((file) => file.id)),
    enabled: files.length > 0,
  });
  const resigned = useRef(false);
  const [viewing, setViewing] = useState<MessageFile | null>(null);
  if (files.length === 0) return null;

  const onError = () => {
    if (resigned.current) return;
    resigned.current = true;
    void refetch();
  };
  const viewUrl = (file: MessageFile) =>
    urls?.get(file.id)?.viewUrl ?? undefined;
  const byKind = (kind: string) =>
    files.filter((file) => fileKind(file.contentType) === kind);
  const images = byKind('image');
  const videos = byKind('video');
  const cards = files.filter(
    (file) => !images.includes(file) && !videos.includes(file)
  );
  const grid = images.slice(0, GRID_MAX);
  const [single] = images;

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {images.length === 1 && single && (
        <MessageImage
          file={single}
          url={viewUrl(single)}
          style={mediaBox(single)}
          onOpen={() => setViewing(single)}
          onError={onError}
        />
      )}
      {images.length > 1 && (
        <div className="grid w-full max-w-96 grid-cols-2 gap-1">
          {grid.map((file, index) => (
            <MessageImage
              key={file.id}
              file={file}
              url={viewUrl(file)}
              className="aspect-square w-full"
              more={index === grid.length - 1 ? images.length - grid.length : 0}
              onOpen={() => setViewing(file)}
              onError={onError}
            />
          ))}
        </div>
      )}
      {videos.map((file) => (
        <MessageVideo
          key={file.id}
          file={file}
          url={viewUrl(file)}
          onError={onError}
        />
      ))}
      {cards.length > 0 && (
        <ul aria-label="Files" className="flex flex-col gap-1.5">
          {cards.map((file) => (
            <li key={file.id}>
              <MessageFileCard
                file={file}
                downloadUrl={urls?.get(file.id)?.downloadUrl}
                onPreview={
                  fileKind(file.contentType) === 'pdf' && viewUrl(file)
                    ? () => setViewing(file)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
      <FileViewer
        file={viewing}
        url={viewing ? urls?.get(viewing.id) : undefined}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
