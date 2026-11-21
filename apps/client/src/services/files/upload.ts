'use client';

import {
  FILE_SIZE_MAX,
  fileKind,
  fileTooLargeMessage,
  type MessageFile,
} from '@conduit/contract';
import { useCallback, useEffect, useRef, useState } from 'react';

import { client } from '@/lib/orpc';

type UploadState =
  | { status: 'uploading'; progress: number }
  | { status: 'ready'; file: MessageFile }
  | { status: 'failed'; error: string };

/** One file picked, dropped, or pasted into a composer. */
export type Upload = UploadState & {
  localId: string;
  name: string;
  size: number;
  contentType: string;
  /** An object URL for an image, so its chip shows a thumbnail before the upload finishes. */
  thumbnailUrl: string | null;
};

const contentTypeOf = (file: File) => file.type || 'application/octet-stream';

/** Sends the bytes with XMLHttpRequest, since fetch reports no upload progress. */
function put(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentTypeOf(file));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status < 300
        ? resolve()
        : reject(new Error('The upload failed. Try again.'));
    request.onerror = () => reject(new Error('The upload failed. Try again.'));
    request.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => request.abort(), { once: true });
    request.send(file);
  });
}

/** The pixel size of an image or video, so its preview holds its space before it loads. Null when unreadable. */
async function measure(
  file: File
): Promise<{ width: number; height: number } | null> {
  const kind = fileKind(contentTypeOf(file));
  try {
    if (kind === 'image') {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    }
    if (kind === 'video') {
      const url = URL.createObjectURL(file);
      try {
        return await new Promise((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () =>
            resolve({ width: video.videoWidth, height: video.videoHeight });
          video.onerror = () => resolve(null);
          video.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  } catch {
    return null;
  }
  return null;
}

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : 'The upload failed. Try again.';

/**
 * The files a composer is about to send. Each one uploads straight to storage as soon as it is added, and
 * `ready` lists what a send may carry. Removing a file stops its upload and drops it on the server.
 */
export function useFileUploads(roomId: string) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const serverIds = useRef(new Map<string, string>());

  const patch = useCallback(
    (localId: string, next: UploadState) =>
      setUploads((current) =>
        current.map((upload) =>
          upload.localId === localId ? { ...upload, ...next } : upload
        )
      ),
    []
  );

  const start = useCallback(
    async (localId: string, file: File) => {
      if (file.size > FILE_SIZE_MAX) {
        patch(localId, {
          status: 'failed',
          error: fileTooLargeMessage(file.size),
        });
        return;
      }
      const controller = new AbortController();
      controllers.current.set(localId, controller);
      try {
        const [{ fileId, uploadUrl }, dimensions] = await Promise.all([
          client.files.uploadUrl({
            roomId,
            name: file.name || 'Pasted file',
            contentType: contentTypeOf(file),
            size: file.size,
          }),
          measure(file),
        ]);
        serverIds.current.set(localId, fileId);
        await put(
          uploadUrl,
          file,
          (progress) => patch(localId, { status: 'uploading', progress }),
          controller.signal
        );
        const stored = await client.files.complete({
          fileId,
          ...dimensions,
        });
        patch(localId, { status: 'ready', file: stored });
      } catch (error) {
        if (controller.signal.aborted) return;
        patch(localId, { status: 'failed', error: errorMessage(error) });
      } finally {
        controllers.current.delete(localId);
      }
    },
    [roomId, patch]
  );

  const add = useCallback(
    (files: File[]) => {
      const added = files.map(
        (file): Upload => ({
          localId: crypto.randomUUID(),
          name: file.name || 'Pasted file',
          size: file.size,
          contentType: contentTypeOf(file),
          thumbnailUrl:
            fileKind(contentTypeOf(file)) === 'image'
              ? URL.createObjectURL(file)
              : null,
          status: 'uploading',
          progress: 0,
        })
      );
      setUploads((current) => [...current, ...added]);
      added.forEach(
        (upload, index) => void start(upload.localId, files[index]!)
      );
    },
    [start]
  );

  const remove = useCallback((localId: string) => {
    controllers.current.get(localId)?.abort();
    const fileId = serverIds.current.get(localId);
    if (fileId) void client.files.cancel({ fileId }).catch(() => undefined);
    serverIds.current.delete(localId);
    setUploads((current) => {
      const upload = current.find((item) => item.localId === localId);
      if (upload?.thumbnailUrl) URL.revokeObjectURL(upload.thumbnailUrl);
      return current.filter((item) => item.localId !== localId);
    });
  }, []);

  /** After a send: the files now belong to the message, so nothing is cancelled. */
  const clear = useCallback(() => {
    serverIds.current.clear();
    setUploads((current) => {
      for (const upload of current) {
        if (upload.thumbnailUrl) URL.revokeObjectURL(upload.thumbnailUrl);
      }
      return [];
    });
  }, []);

  useEffect(() => {
    const running = controllers.current;
    return () => {
      for (const controller of running.values()) controller.abort();
    };
  }, []);

  const ready = uploads.flatMap((upload) =>
    upload.status === 'ready' ? [upload.file] : []
  );
  const uploading = uploads.filter(
    (upload) => upload.status === 'uploading'
  ).length;

  return { uploads, ready, uploading, add, remove, clear };
}

export type FileUploads = ReturnType<typeof useFileUploads>;
