'use client';

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

import { authClient } from '@/services/auth/client';

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
  setActive: (organizationId: string) => Promise<void>;
};

const EMPTY_WORKSPACES: Workspace[] = [];

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: workspaces, isPending: isListPending } =
    authClient.useListOrganizations();
  const { data: activeOrganization, isPending: isActivePending } =
    authClient.useActiveOrganization();

  const isPending = isListPending || isActivePending;
  const firstId = workspaces?.[0]?.id;
  const activeId = activeOrganization?.id;

  useEffect(() => {
    if (isPending || activeId || !firstId) {
      return;
    }

    void authClient.organization.setActive({ organizationId: firstId });
  }, [activeId, firstId, isPending]);

  const setActive = useCallback(async (organizationId: string) => {
    await authClient.organization.setActive({ organizationId });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces: workspaces ?? EMPTY_WORKSPACES,
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
