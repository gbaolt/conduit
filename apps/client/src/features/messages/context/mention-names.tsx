'use client';

import { createContext, use } from 'react';

const EMPTY: ReadonlyMap<string, string> = new Map();

/** Display names by user id, so a `<@userId>` in a message reads as a person. */
export const MentionNames = createContext<ReadonlyMap<string, string>>(EMPTY);

export function useMentionName(target: string) {
  const names = use(MentionNames);
  if (target === 'channel' || target === 'here') return `@${target}`;
  return `@${names.get(target) ?? 'unknown member'}`;
}
