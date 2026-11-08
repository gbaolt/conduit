'use client';

import { useMemo } from 'react';

import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import type { Author } from '../components/message/message-row';

/** The workspace's members by id: for the avatar and name on a row, and the name a `<@userId>` shows. */
export function useAuthors() {
  const { data: members } = useWorkspaceMembers();

  return useMemo(() => {
    const authors = new Map<string, Author>();
    const names = new Map<string, string>();
    for (const member of members ?? []) {
      authors.set(member.userId, { name: member.name, image: member.image });
      names.set(member.userId, member.name);
    }
    return { authors, names };
  }, [members]);
}
