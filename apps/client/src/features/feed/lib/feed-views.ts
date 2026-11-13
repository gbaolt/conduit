import { type FeedSource, FeedSourceSchema } from '@conduit/contract';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { normalizeSources } from '@/services/feed/queries';

/** A named set of sources. A tab shows it, and it is active while the URL's sources are the same set. */
export type FeedView = {
  id: string;
  name: string;
  sources: FeedSource[];
  custom?: true;
};

export const FEED_VIEWS: readonly FeedView[] = [
  { id: 'all', name: 'All', sources: [] },
  { id: 'dms', name: 'DMs', sources: ['dm'] },
  { id: 'mentions', name: 'Mentions', sources: ['mention'] },
  { id: 'threads', name: 'Threads', sources: ['thread_reply'] },
];

export const FEED_VIEW_NAME_MAX = 40;

export const sameSources = (
  a: readonly FeedSource[],
  b: readonly FeedSource[]
) => normalizeSources(a).join() === normalizeSources(b).join();

const STORAGE_KEY = 'conduit:activity-views';

const StoredViewsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string().min(1).max(FEED_VIEW_NAME_MAX),
    sources: z.array(FeedSourceSchema).min(1),
  })
);

/** The viewer's custom views. Anything unreadable in storage reads as none. */
function readStored(): FeedView[] {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]'
    );
    return StoredViewsSchema.parse(stored).map((view) => ({
      ...view,
      custom: true,
    }));
  } catch {
    return [];
  }
}

/**
 * The default views, then the viewer's custom views.
 * shortcut: custom views live in this browser's localStorage, so they do not follow the member to another device. Move them to the server once members ask for that.
 */
export function useFeedViews() {
  const [custom, setCustom] = useState<FeedView[]>([]);

  // Read after mount, so the server render matches.
  useEffect(() => setCustom(readStored()), []);

  const save = (next: FeedView[]) => {
    setCustom(next);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          next.map(({ id, name, sources }) => ({ id, name, sources }))
        )
      );
    } catch {
      // Private mode or blocked storage: the view still works for this visit.
    }
  };

  return {
    views: [...FEED_VIEWS, ...custom],
    create: (name: string, sources: readonly FeedSource[]) =>
      save([
        ...custom,
        {
          id: crypto.randomUUID(),
          name: name.slice(0, FEED_VIEW_NAME_MAX),
          sources: normalizeSources(sources),
          custom: true,
        },
      ]),
    remove: (id: string) => save(custom.filter((view) => view.id !== id)),
  };
}

export type FeedViews = ReturnType<typeof useFeedViews>;
