'use client';

import { formatFileSize, type MessageFile } from '@conduit/contract';
import { Button, buttonVariants } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { IconAlertCircle, IconDownload, IconX } from '@tabler/icons-react';
import { type ComponentProps, createContext, type ReactNode, use } from 'react';

import { FileKindIcon } from '@/components/file-kind-icon';

/** A file to show: sent, or still uploading. `previewUrl` is set only for a picture that can show. */
export type AttachmentFile = Pick<
  MessageFile,
  'name' | 'contentType' | 'size'
> &
  Partial<Pick<MessageFile, 'width' | 'height'>> & {
    previewUrl?: string | null;
  };

/** `inline` is the compact chip row of a composer. `grid` shows pictures as thumbnails, as under a sent question. */
type AttachmentsVariant = 'inline' | 'grid';

const AttachmentsContext = createContext<AttachmentsVariant>('inline');

type AttachmentState = {
  file: AttachmentFile;
  /** A grid picture shows as a thumbnail, and every other file as a card. */
  thumbnail: boolean;
};

const AttachmentContext = createContext<AttachmentState | null>(null);

function useAttachment() {
  const attachment = use(AttachmentContext);
  if (!attachment)
    throw new Error('Attachment parts must sit inside <Attachment>.');
  return attachment;
}

/** A row of files. Files of different heights line up along the bottom of each row. */
export function Attachments({
  variant = 'inline',
  className,
  ...props
}: ComponentProps<'ul'> & { variant?: AttachmentsVariant }) {
  return (
    <AttachmentsContext value={variant}>
      <ul
        aria-label="Attached files"
        data-slot="attachments"
        data-variant={variant}
        className={cn('flex flex-wrap items-end gap-2', className)}
        {...props}
      />
    </AttachmentsContext>
  );
}

/** One file. Its parts are children: a preview, its name and size, and what can be done with it. */
export function Attachment({
  data,
  className,
  ...props
}: ComponentProps<'li'> & { data: AttachmentFile }) {
  const variant = use(AttachmentsContext);
  const thumbnail = variant === 'grid' && !!data.previewUrl;

  return (
    <AttachmentContext value={{ file: data, thumbnail }}>
      <li
        data-slot="attachment"
        className={cn(
          'group/attachment bg-background relative min-w-0 rounded-md border transition-[background-color,scale] duration-150 ease-out',
          'has-data-[slot=attachment-open]:hover:bg-muted has-[[data-slot=attachment-open]:active]:scale-[0.98] motion-reduce:has-[[data-slot=attachment-open]:active]:scale-100',
          thumbnail
            ? 'overflow-hidden rounded-lg'
            : 'flex h-12 max-w-full items-center gap-2.5 p-1',
          variant === 'grid' && !thumbnail && 'h-14 max-w-64 px-2',
          variant === 'inline' &&
            'animate-in fade-in-0 zoom-in-[0.97] ease-out-cubic',
          'has-data-[slot=attachment-error]:border-destructive/40 has-data-[slot=attachment-error]:h-auto has-data-[slot=attachment-error]:min-h-12',
          className
        )}
        {...props}
      />
    </AttachmentContext>
  );
}

/** The picture, or the file's kind as an icon. Children draw over it, such as upload progress. */
export function AttachmentPreview({
  className,
  children,
  ...props
}: ComponentProps<'span'>) {
  const { file, thumbnail } = useAttachment();

  return (
    <span
      data-slot="attachment-preview"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden',
        !thumbnail && 'bg-muted text-muted-foreground size-10 rounded-sm',
        className
      )}
      {...props}
    >
      {file.previewUrl ? (
        <img
          src={file.previewUrl}
          alt=""
          width={file.width ?? undefined}
          height={file.height ?? undefined}
          className={
            thumbnail
              ? 'h-20 w-auto max-w-40 object-cover'
              : 'size-full object-cover'
          }
        />
      ) : (
        <FileKindIcon contentType={file.contentType} className="size-5" />
      )}
      {children}
    </span>
  );
}

/** The file's name, and under it its size, or the children in its place when there are any. */
export function AttachmentInfo({
  className,
  children,
  ...props
}: ComponentProps<'span'>) {
  const { file } = useAttachment();

  return (
    <span
      data-slot="attachment-info"
      className={cn('flex min-w-0 flex-1 flex-col', className)}
      {...props}
    >
      <span className="max-w-48 truncate text-sm leading-5" title={file.name}>
        {file.name}
      </span>
      {children || (
        <span className="text-muted-foreground text-xs leading-4 tabular-nums">
          {formatFileSize(file.size)}
        </span>
      )}
    </span>
  );
}

/** Why the file can't be sent, in place of its size. */
export function AttachmentError({ children }: { children: ReactNode }) {
  return (
    <span
      data-slot="attachment-error"
      className="text-destructive flex max-w-72 items-start gap-1 text-xs leading-4"
    >
      <IconAlertCircle className="mt-px size-3.5 shrink-0" />
      {children}
    </span>
  );
}

const RING = 2 * Math.PI * 9;

/** Upload progress drawn over the preview. The stroke eases between progress events instead of jumping. */
export function AttachmentProgress({ progress }: { progress: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="bg-background/70 absolute inset-0 m-auto size-6 rounded-full"
      role="progressbar"
      aria-label="Uploading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        strokeWidth="2.5"
        className="stroke-muted-foreground/25"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={RING}
        strokeDashoffset={RING * (1 - progress)}
        transform="rotate(-90 12 12)"
        className="stroke-foreground transition-[stroke-dashoffset] duration-200 ease-linear"
      />
    </svg>
  );
}

/** Takes the file out before it is sent. */
export function AttachmentRemove({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  const { file } = useAttachment();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Remove ${file.name}`}
      data-slot="attachment-remove"
      className={cn('self-start pointer-coarse:size-11', className)}
      {...props}
    >
      <IconX />
    </Button>
  );
}

/**
 * Makes the whole file pressable. With `href` it downloads the file, and shows a download icon at its end.
 * Otherwise `onClick` opens it, as in the file viewer.
 */
export function AttachmentOpen({
  href,
  onClick,
}: {
  href?: string;
  onClick?: () => void;
}) {
  const { file } = useAttachment();
  const className = cn(
    buttonVariants({ variant: 'ghost' }),
    'absolute inset-0 h-auto justify-end rounded-[inherit] bg-transparent px-2 hover:bg-transparent dark:hover:bg-transparent'
  );

  if (href) {
    return (
      <a
        href={href}
        download={file.name}
        data-slot="attachment-open"
        aria-label={`Download ${file.name}, ${formatFileSize(file.size)}`}
        className={className}
      >
        <IconDownload
          aria-hidden
          className="text-muted-foreground group-hover/attachment:text-foreground size-4 transition-colors"
        />
      </a>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="attachment-open"
      aria-label={`Open ${file.name}`}
      className={className}
      onClick={onClick}
    />
  );
}
