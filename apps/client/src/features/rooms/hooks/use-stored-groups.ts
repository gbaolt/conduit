import { useEffect, useState } from 'react';

const storageKey = (name: string, workspaceId: string) =>
  `conduit:${name}:${workspaceId}`;

/** The stored list, or null when storage cannot be read. */
function readStored(
  name: string,
  workspaceId: string | undefined
): string[] | null {
  if (!workspaceId) return null;
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey(name, workspaceId)) ?? '[]'
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return null;
  }
}

/**
 * A set of sidebar group ids the viewer chose, such as the collapsed groups, kept in localStorage under `name`
 * per workspace. Read after mount so the server render matches.
 */
export function useStoredGroups(name: string, workspaceId: string | undefined) {
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    setGroups(readStored(name, workspaceId) ?? []);
  }, [name, workspaceId]);

  // Each group runs its own copy of this hook, so a toggle starts from what storage holds now,
  // or it would drop the groups another copy toggled.
  const toggle = (groupId: string) => {
    const current = readStored(name, workspaceId) ?? groups;
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    setGroups(next);
    if (!workspaceId) return;
    try {
      localStorage.setItem(storageKey(name, workspaceId), JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: the choice still holds for this visit.
    }
  };

  return { has: (groupId: string) => groups.includes(groupId), toggle };
}
