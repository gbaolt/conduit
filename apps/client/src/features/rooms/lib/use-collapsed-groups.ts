import { useEffect, useState } from 'react';

const storageKey = (workspaceId: string) =>
  `conduit:collapsed-sidebar-groups:${workspaceId}`;

/** The stored list, or null when storage cannot be read. */
function readStored(workspaceId: string | undefined): string[] | null {
  if (!workspaceId) return null;
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey(workspaceId)) ?? '[]'
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return null;
  }
}

/** Which sidebar groups the viewer collapsed, kept in localStorage. Read after mount so the server render matches. */
export function useCollapsedGroups(workspaceId: string | undefined) {
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    setCollapsed(readStored(workspaceId) ?? []);
  }, [workspaceId]);

  // Each group runs its own copy of this hook, so a toggle starts from what storage holds now,
  // or it would drop the groups another copy collapsed.
  const toggle = (groupId: string) => {
    const current = readStored(workspaceId) ?? collapsed;
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    setCollapsed(next);
    if (!workspaceId) return;
    try {
      localStorage.setItem(storageKey(workspaceId), JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: collapse still works for this visit.
    }
  };

  return {
    isCollapsed: (groupId: string) => collapsed.includes(groupId),
    toggle,
  };
}
