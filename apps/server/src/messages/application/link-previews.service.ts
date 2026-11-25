import { linksIn, type Message } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { isCanvasLink } from '@/messages/domain/canvas-link';
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

  /**
   * Fetches the first eligible link and stores its preview, which bumps `updatedAt` so the live
   * query delivers it. Runs after the send commits and treats preview failures as best effort.
   */
  async attach(message: Pick<Message, 'id' | 'body'>) {
    for (const link of linksIn(message.body)) {
      if (!URL.canParse(link) || isCanvasLink(new URL(link), this.appOrigin)) {
        continue;
      }

      try {
        const preview = await this.fetcher.fetch(link);
        if (preview) {
          await this.messages.setLinkPreview(message.id, preview, message.body);
        }
      } catch {
        // A preview is best effort.
      }
      return;
    }
  }
}
