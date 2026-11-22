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
import { useQuery } from '@tanstack/react-query';

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockWrapButton,
} from '@/components/code-block';
import { snippetLanguage } from '@/features/messages/lib/snippet-preview';
import { fileTextQuery } from '@/services/files/queries';

/** A text file's start, highlighted, with wrap and copy. Says so when the file runs past what was read. */
function FileViewerText({ file }: { file: MessageFile }) {
  const { data, isError } = useQuery(fileTextQuery(file.id));

  if (isError) {
    return (
      <p className="text-muted-foreground p-6 text-sm">
        This file can&apos;t be shown here. Download it to open it.
      </p>
    );
  }
  if (!data) return <Skeleton className="absolute inset-0" />;

  return (
    <CodeBlock className="my-0 h-full [&_pre]:h-full [&_pre]:max-h-none">
      <CodeBlockHeader language={file.name}>
        {data.truncated && (
          <span className="pr-1 font-sans">Showing the first 64 KB</span>
        )}
        <CodeBlockWrapButton />
        <CodeBlockCopyButton value={data.text} />
      </CodeBlockHeader>
      <CodeBlockContent
        code={data.text}
        language={snippetLanguage(file.name)}
      />
    </CodeBlock>
  );
}

/** One file opened over the page: an image at full size, a video, a PDF in the browser's reader, or text. */
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
              {kind === 'text' && <FileViewerText file={file} />}
              {kind !== 'text' && !url?.viewUrl && (
                <Skeleton className="absolute inset-0" />
              )}
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
