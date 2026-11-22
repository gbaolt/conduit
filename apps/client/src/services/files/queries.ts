import type { ListFilesInput } from '@conduit/contract';

import { orpc } from '@/lib/orpc';

/** The links last 10 minutes, so a cached set is refetched a minute before they expire. */
const URL_FRESH_MS = 9 * 60 * 1000;

/** View and download links for one message's files, or one file on the Files page. */
export const fileUrlsQuery = (fileIds: string[]) =>
  orpc.files.urls.queryOptions({
    input: { fileIds },
    staleTime: URL_FRESH_MS,
    gcTime: URL_FRESH_MS,
    select: (urls) => new Map(urls.map((url) => [url.id, url])),
  });

/** The start of a sent text file. A sent file never changes, so it is fetched once. */
export const fileTextQuery = (fileId: string) =>
  orpc.files.text.queryOptions({
    input: { fileId },
    staleTime: Infinity,
    retry: false,
  });

export type FilesListInput = Omit<ListFilesInput, 'before' | 'limit'>;

/** Pages of the Files page, newest first. Empty filters are left out, so `?type=` and none share a cache entry. */
export const filesQuery = ({
  roomId,
  uploaderId,
  kind,
  name,
}: FilesListInput) => {
  const input = {
    roomId: roomId || undefined,
    uploaderId: uploaderId || undefined,
    kind,
    name: name?.trim() || undefined,
  };
  return orpc.files.list.infiniteOptions({
    input: (before: string | undefined) => ({ ...input, before }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore ? last.files.at(-1)?.id : undefined,
  });
};
