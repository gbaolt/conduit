import { useEffect, useState } from 'react';

const storageKey = (workspaceId: string) =>
  `conduit:collapsed-sidebar-groups:${workspaceId}`;

/** Which sidebar groups the viewer collapsed, kept in localStorage. Read after mount so the server render matches. */
export function useCollapsedGroups(workspaceId: string | undefined) {
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const stored = JSON.parse(
        localStorage.getItem(storageKey(workspaceId)) ?? '[]'
      );
      setCollapsed(Array.isArray(stored) ? stored : []);
    } catch {
      setCollapsed([]);
    }
  }, [workspaceId]);

  const toggle = (groupId: string) => {
    const next = collapsed.includes(groupId)
      ? collapsed.filter((id) => id !== groupId)
      : [...collapsed, groupId];
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
