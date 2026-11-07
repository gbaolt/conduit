import { firstLink, type Message } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { LinkPreviewFetcher } from '@/messages/domain/link-preview.fetcher';
import { MessagesRepository } from '@/messages/domain/messages.repository';

@Injectable()
export class LinkPreviewsService {
  constructor(
    @Inject(MessagesRepository) private readonly messages: MessagesRepository,
    @Inject(LinkPreviewFetcher) private readonly fetcher: LinkPreviewFetcher
  ) {}

  /**
   * Fetches the preview of the message's first link and stores it, which bumps `updatedAt` so the live
   * query delivers it. Runs after the send commits and never fails: a message without a preview is fine.
   */
  async attach(message: Pick<Message, 'id' | 'body'>) {
    const link = firstLink(message.body);
    if (!link) return;

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
