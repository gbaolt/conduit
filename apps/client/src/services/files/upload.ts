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

/** Where a composer's files go: a room's message, or an Ask question. */
export type UploadTarget = {
  /** How many files one send may carry. Files past it fail with a note instead of uploading. */
  max?: number;
  /** Runs before the upload, as when Ask shrinks a large image. */
  prepare?: (file: File) => Promise<File>;
  /** Why the file can't go, or null. Checked after `prepare`. */
  problem: (file: File) => string | null;
  sign: (file: {
    name: string;
    contentType: string;
    size: number;
  }) => Promise<{ id: string; uploadUrl: string }>;
  complete: (
    id: string,
    dimensions: { width: number; height: number } | null
  ) => Promise<MessageFile>;
  /** Drops an upload the composer removed. Without it, the server's sweep removes it later. */
  cancel?: (id: string) => Promise<void>;
};

/** A message in `roomId`. Its files count toward the workspace's storage. */
export const roomUploads = (roomId: string): UploadTarget => ({
  problem: (file) =>
    file.size > FILE_SIZE_MAX ? fileTooLargeMessage(file.size) : null,
  sign: async (file) => {
    const { fileId, uploadUrl } = await client.files.uploadUrl({
      roomId,
      ...file,
    });
    return { id: fileId, uploadUrl };
  },
  complete: (fileId, dimensions) =>
    client.files.complete({ fileId, ...dimensions }),
  cancel: (fileId) => client.files.cancel({ fileId }),
});

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
 * `ready` lists what a send may carry. Removing a file stops its upload and drops it on the server. `target`
 * must keep its identity between renders.
 */
export function useFileUploads(target: UploadTarget) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  // What `add` counts against `target.max`, current even between two adds in one event.
  const uploadsRef = useRef(uploads);
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);
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
    async (localId: string, picked: File) => {
      const controller = new AbortController();
      controllers.current.set(localId, controller);
      try {
        const file = target.prepare ? await target.prepare(picked) : picked;
        const problem = target.problem(file);
        if (problem) {
          patch(localId, { status: 'failed', error: problem });
          return;
        }
        const [{ id, uploadUrl }, dimensions] = await Promise.all([
          target.sign({
            name: picked.name || 'Pasted file',
            contentType: contentTypeOf(file),
            size: file.size,
          }),
          measure(file),
        ]);
        if (controller.signal.aborted) return;
        serverIds.current.set(localId, id);
        await put(
          uploadUrl,
          file,
          (progress) => patch(localId, { status: 'uploading', progress }),
          controller.signal
        );
        const stored = await target.complete(id, dimensions);
        patch(localId, { status: 'ready', file: stored });
      } catch (error) {
        if (controller.signal.aborted) return;
        patch(localId, { status: 'failed', error: errorMessage(error) });
      } finally {
        controllers.current.delete(localId);
      }
    },
    [target, patch]
  );

  const add = useCallback(
    (files: File[]) => {
      const room =
        target.max === undefined
          ? files.length
          : target.max -
            uploadsRef.current.filter((upload) => upload.status !== 'failed')
              .length;
      const added = files.map(
        (file, index): Upload => ({
          localId: crypto.randomUUID(),
          name: file.name || 'Pasted file',
          size: file.size,
          contentType: contentTypeOf(file),
          thumbnailUrl:
            fileKind(contentTypeOf(file)) === 'image'
              ? URL.createObjectURL(file)
              : null,
          ...(index < room
            ? { status: 'uploading', progress: 0 }
            : {
                status: 'failed',
                error: `A question can carry up to ${target.max} files.`,
              }),
        })
      );
      uploadsRef.current = [...uploadsRef.current, ...added];
      setUploads((current) => [...current, ...added]);
      added.forEach((upload, index) => {
        if (upload.status === 'uploading') {
          void start(upload.localId, files[index]!);
        }
      });
    },
    [start, target.max]
  );

  const remove = useCallback(
    (localId: string) => {
      controllers.current.get(localId)?.abort();
      const id = serverIds.current.get(localId);
      if (id) void target.cancel?.(id).catch(() => undefined);
      serverIds.current.delete(localId);
      setUploads((current) => {
        const upload = current.find((item) => item.localId === localId);
        if (upload?.thumbnailUrl) URL.revokeObjectURL(upload.thumbnailUrl);
        return current.filter((item) => item.localId !== localId);
      });
    },
    [target]
  );

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
