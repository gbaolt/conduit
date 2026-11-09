'use client';

import { useCallback, useMemo } from 'react';

import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import type { Author } from '../components/message/message';

const FORMER_MEMBER: Author = { name: 'Former member', image: null };

/**
 * The workspace's members by id: for the avatar and name on a row, and the name a `<@userId>` shows.
 * `authorOf` is null until the members load, and "Former member" for someone no longer in the workspace.
 */
export function useAuthors() {
  const { data: members } = useWorkspaceMembers();

  const { authors, names } = useMemo(() => {
    const authors = new Map<string, Author>();
    const names = new Map<string, string>();
    for (const member of members ?? []) {
      authors.set(member.userId, member);
      names.set(member.userId, member.name);
    }
    return { authors, names };
  }, [members]);

  const authorOf = useCallback(
    (userId: string): Author | null =>
      members ? (authors.get(userId) ?? FORMER_MEMBER) : null,
    [members, authors]
  );

  return { authorOf, names };
}
