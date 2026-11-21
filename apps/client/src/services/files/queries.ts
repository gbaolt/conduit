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
