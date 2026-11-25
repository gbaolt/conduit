import { firstLink, type Message } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { LinkPreviewFetcher } from '@/messages/domain/link-preview.fetcher';
import { MessagesRepository } from '@/messages/domain/messages.repository';

export const LINK_PREVIEW_APP_ORIGIN = Symbol('LINK_PREVIEW_APP_ORIGIN');

@Injectable()
export class LinkPreviewsService {
  constructor(
    @Inject(MessagesRepository) private readonly messages: MessagesRepository,
    @Inject(LinkPreviewFetcher) private readonly fetcher: LinkPreviewFetcher,
    @Inject(LINK_PREVIEW_APP_ORIGIN) private readonly appOrigin: string
  ) {}

  private isCanvasLink(link: string) {
    if (!URL.canParse(link)) return false;
    const url = new URL(link);
    if (url.origin !== this.appOrigin) return false;
    if (/^\/canvases\/[^/]+\/?$/.test(url.pathname)) return true;

    const tab = url.searchParams.get('tab');
    return (
      /^\/(channels|dms)\/[^/]+\/?$/.test(url.pathname) &&
      Boolean(tab && tab !== 'messages')
    );
  }

  /**
   * Fetches the preview of the message's first link and stores it, which bumps `updatedAt` so the live
   * query delivers it. Runs after the send commits and never fails: a message without a preview is fine.
   */
  async attach(message: Pick<Message, 'id' | 'body'>) {
    const link = firstLink(message.body);
    if (!link || this.isCanvasLink(link)) return;

    try {
      const preview = await this.fetcher.fetch(link);
      if (preview) {
        await this.messages.setLinkPreview(message.id, preview, message.body);
      }
    } catch {
      // A preview is best effort.
    }
  }
}
