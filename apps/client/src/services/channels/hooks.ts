'use client';

import { useEffect } from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { useSwitchWorkspace } from '@/services/workspaces/hooks';

/** A channel link can point into another workspace the viewer belongs to: make that workspace active, once. */
export function useActivateChannelWorkspace(organizationId: string) {
  const { activeWorkspace, isPending } = useWorkspace();
  const { mutate: switchWorkspace, isIdle } = useSwitchWorkspace();
  const activeId = activeWorkspace?.id;

  useEffect(() => {
    // An empty active workspace is WorkspaceProvider's job to fill.
    if (isPending || !activeId || activeId === organizationId || !isIdle) {
      return;
    }

    switchWorkspace(organizationId);
  }, [activeId, isIdle, isPending, organizationId, switchWorkspace]);
}
