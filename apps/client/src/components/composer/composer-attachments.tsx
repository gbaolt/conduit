'use client';

import { formatFileSize } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { IconAlertCircle, IconX } from '@tabler/icons-react';

import { FileKindIcon } from '@/components/file-kind-icon';
import type { Upload } from '@/services/files/upload';

const RING = 2 * Math.PI * 9;

/** Upload progress drawn over the thumbnail. The stroke eases between progress events instead of jumping. */
function ComposerAttachmentProgress({ progress }: { progress: number }) {
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

/** One file in the row: its thumbnail or kind icon, its name, and its size or what went wrong. */
export function ComposerAttachment({
  upload,
  onRemove,
}: {
  upload: Upload;
  onRemove: () => void;
}) {
  const failed = upload.status === 'failed';

  return (
    <li
      className={cn(
        'bg-background animate-in fade-in-0 zoom-in-[0.97] ease-out-cubic relative flex h-12 max-w-full min-w-0 items-center gap-2.5 rounded-md border py-1 pr-1 pl-1 duration-150',
        failed && 'border-destructive/40 h-auto min-h-12'
      )}
    >
      <span className="bg-muted text-muted-foreground relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm">
        {upload.thumbnailUrl ? (
          <img
            src={upload.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <FileKindIcon contentType={upload.contentType} className="size-5" />
        )}
        {upload.status === 'uploading' && (
          <ComposerAttachmentProgress progress={upload.progress} />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className="max-w-48 truncate text-sm leading-5"
          title={upload.name}
        >
          {upload.name}
        </span>
        {failed ? (
          <span className="text-destructive flex max-w-72 items-start gap-1 text-xs leading-4">
            <IconAlertCircle className="mt-px size-3.5 shrink-0" />
            {upload.error}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs leading-4 tabular-nums">
            {formatFileSize(upload.size)}
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${upload.name}`}
        className="self-start pointer-coarse:size-11"
        onClick={onRemove}
      >
        <IconX />
      </Button>
    </li>
  );
}

/** The files a message is about to carry, above the composer's bottom bar. */
export function ComposerAttachments({
  uploads,
  onRemove,
}: {
  uploads: Upload[];
  onRemove: (localId: string) => void;
}) {
  if (uploads.length === 0) return null;

  return (
    <ul aria-label="Attached files" className="flex flex-wrap gap-2 px-2 pb-2">
      {uploads.map((upload) => (
        <ComposerAttachment
          key={upload.localId}
          upload={upload}
          onRemove={() => onRemove(upload.localId)}
        />
      ))}
    </ul>
  );
}
