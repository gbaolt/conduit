'use client';

import {
  fileKind,
  type FileUrl,
  formatFileSize,
  type MessageFile,
} from '@conduit/contract';
import { buttonVariants } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconDownload } from '@tabler/icons-react';

/** One file opened over the page: an image at full size, a video, or a PDF in the browser's reader. */
export function FileViewer({
  file,
  url,
  onClose,
}: {
  file: MessageFile | null;
  url: FileUrl | undefined;
  onClose: () => void;
}) {
  const kind = file && fileKind(file.contentType);

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(90vh,960px)] flex-col gap-3 sm:max-w-[min(92vw,1200px)]">
        {file && (
          <>
            <DialogHeader className="flex-row items-center gap-2 pr-10">
              <DialogTitle className="min-w-0 truncate">
                {file.name}
              </DialogTitle>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatFileSize(file.size)}
              </span>
              {url && (
                <a
                  href={url.downloadUrl}
                  download={file.name}
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'sm',
                    className: 'ml-auto',
                  })}
                >
                  <IconDownload data-icon="inline-start" />
                  Download
                </a>
              )}
            </DialogHeader>
            <div className="bg-muted relative min-h-0 flex-1 overflow-hidden rounded-md">
              {!url?.viewUrl && <Skeleton className="absolute inset-0" />}
              {url?.viewUrl && kind === 'image' && (
                <img
                  src={url.viewUrl}
                  alt={file.name}
                  className="size-full object-contain"
                />
              )}
              {url?.viewUrl && kind === 'video' && (
                <video
                  src={url.viewUrl}
                  controls
                  aria-label={file.name}
                  className="size-full"
                />
              )}
              {url?.viewUrl && kind === 'pdf' && (
                <iframe
                  src={url.viewUrl}
                  title={file.name}
                  className="size-full"
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
