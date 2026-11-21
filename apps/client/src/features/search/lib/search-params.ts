import { parseAsString, parseAsStringLiteral } from 'nuqs';

export const SEARCH_TABS = ['messages', 'files', 'channels', 'people'] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export const searchParams = {
  q: parseAsString.withDefault(''),
  tab: parseAsStringLiteral(SEARCH_TABS).withDefault('messages'),
};
