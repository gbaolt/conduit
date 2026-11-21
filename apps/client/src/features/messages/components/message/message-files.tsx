'use client';

import { formatFileSize, type MessageFile } from '@conduit/contract';
import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { FileKindIcon } from '@/components/file-kind-icon';
import { fileUrlsQuery } from '@/services/files/queries';

/** One file under a message: its kind, name, and size, and a download link once the link is signed. */
export function MessageFileCard({
  file,
  downloadUrl,
}: {
  file: MessageFile;
  downloadUrl?: string;
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
      {downloadUrl && (
        <IconDownload
          aria-hidden
          className="text-muted-foreground group-hover/file:text-foreground size-4 shrink-0 transition-colors"
        />
      )}
    </>
  );
  const className =
    'group/file bg-background flex h-14 w-full max-w-80 min-w-0 items-center gap-2.5 rounded-md border px-2';

  if (!downloadUrl) return <div className={className}>{body}</div>;

  return (
    <a
      href={downloadUrl}
      download={file.name}
      aria-label={`Download ${file.name}, ${formatFileSize(file.size)}`}
      className={`${className} hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-3`}
    >
      {body}
    </a>
  );
}

/** The files a sent message carries. Signs their links once and reuses them until they near expiry. */
export function MessageFiles({ files }: { files: MessageFile[] }) {
  const { data: urls } = useQuery({
    ...fileUrlsQuery(files.map((file) => file.id)),
    enabled: files.length > 0,
  });
  if (files.length === 0) return null;

  return (
    <ul aria-label="Files" className="mt-1 flex flex-col gap-1.5">
      {files.map((file) => (
        <li key={file.id}>
          <MessageFileCard
            file={file}
            downloadUrl={urls?.get(file.id)?.downloadUrl}
          />
        </li>
      ))}
    </ul>
  );
}
