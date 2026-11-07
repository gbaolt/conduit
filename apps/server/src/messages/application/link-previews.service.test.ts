import type { LinkPreview } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { LinkPreviewFetcher } from '@/messages/domain/link-preview.fetcher';
import type { MessagesRepository } from '@/messages/domain/messages.repository';

import { LinkPreviewsService } from './link-previews.service';

const preview: LinkPreview = {
  url: 'https://example.com',
  siteName: null,
  title: 'Example',
  description: null,
  image: null,
};

function setup(fetch: LinkPreviewFetcher['fetch']) {
  const stored: { id: string; preview: LinkPreview | null; body?: string }[] =
    [];
  const requested: string[] = [];
  const messages = {
    setLinkPreview: async (id, value, body) => {
      stored.push({ id, preview: value, body });
      return null;
    },
  } as Partial<MessagesRepository> as MessagesRepository;
  const fetcher: LinkPreviewFetcher = {
    fetch: async (url) => {
      requested.push(url);
      return fetch(url);
    },
  };
  return {
    service: new LinkPreviewsService(messages, fetcher),
    stored,
    requested,
  };
}

describe('LinkPreviewsService.attach', () => {
  it('stores the preview of the first link against the body it read', async () => {
    const { service, stored, requested } = setup(async () => preview);

    await service.attach({
      id: 'm1',
      body: 'read https://example.com first, then https://other.dev',
    });

    expect(requested).toEqual(['https://example.com']);
    expect(stored).toEqual([
      {
        id: 'm1',
        preview,
        body: 'read https://example.com first, then https://other.dev',
      },
    ]);
  });

  it('does nothing for a message without a link', async () => {
    const { service, stored, requested } = setup(async () => preview);

    await service.attach({ id: 'm1', body: 'no link here' });

    expect(requested).toEqual([]);
    expect(stored).toEqual([]);
  });

  it('stores nothing when the page has no preview', async () => {
    const { service, stored } = setup(async () => null);

    await service.attach({ id: 'm1', body: 'https://example.com' });

    expect(stored).toEqual([]);
  });

  it('swallows a failure', async () => {
    const { service } = setup(async () => {
      throw new Error('boom');
    });

    await expect(
      service.attach({ id: 'm1', body: 'https://example.com' })
    ).resolves.toBeUndefined();
  });
});
