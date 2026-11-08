import type { LinkPreview } from '@conduit/contract';

/** Reads how a page describes itself. Never throws: a page it cannot or may not read has no preview. */
export abstract class LinkPreviewFetcher {
  abstract fetch(url: string): Promise<LinkPreview | null>;
}
