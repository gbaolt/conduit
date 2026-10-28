'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useEffect, useMemo } from 'react';

import {
  useActiveWorkspace,
  useSwitchWorkspace,
} from '@/services/workspaces/hooks';
import { workspacesQuery } from '@/services/workspaces/queries';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isPending: boolean;
  setActive: (organizationId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);
  const { mutate: setActive } = useSwitchWorkspace();
  const { data: activeOrganization, isPending: isActivePending } =
    useActiveWorkspace();

  const isPending = isActivePending;
  const firstId = workspaces[0]?.id;
  const activeId = activeOrganization?.id;

  useEffect(() => {
    if (isPending || activeId || !firstId) {
      return;
    }

    setActive(firstId);
  }, [activeId, firstId, isPending, setActive]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace: activeOrganization
        ? {
            id: activeOrganization.id,
            name: activeOrganization.name,
            slug: activeOrganization.slug,
            logo: activeOrganization.logo,
          }
        : null,
      isPending,
      setActive,
    }),
    [activeOrganization, isPending, setActive, workspaces]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = use(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }

  return context;
}
