import { FEED_SOURCES } from '@conduit/contract';
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

export const FEED_SORTS = ['smart', 'newest'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

/** The Activity page's state, kept in the URL, as in `?show=mention,reaction&unread=true&sort=newest&q=launch`. */
export const feedParams = {
  /** Empty shows every source. */
  show: parseAsArrayOf(parseAsStringLiteral(FEED_SOURCES)).withDefault([]),
  unread: parseAsBoolean.withDefault(false),
  sort: parseAsStringLiteral(FEED_SORTS).withDefault('smart'),
  q: parseAsString.withDefault(''),
};

/** Reads `feedParams` from a page's `searchParams`, so the server prefetches the list the client asks for. */
export const loadFeedParams = createLoader(feedParams);
