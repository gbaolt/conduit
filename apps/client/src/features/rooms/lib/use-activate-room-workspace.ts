'use client';

import { useEffect, useRef } from 'react';

import { useWorkspace } from '@/features/workspace/context/workspace-provider';
import { useSwitchWorkspace } from '@/services/workspaces/hooks';

/** A channel link can point into another workspace the viewer belongs to: make that workspace active, once per channel. */
export function useActivateRoomWorkspace(
  roomId: string,
  organizationId: string
) {
  const { activeWorkspace, isPending } = useWorkspace();
  const { mutate: switchWorkspace } = useSwitchWorkspace();
  const checkedChannelId = useRef<string | null>(null);
  const activeId = activeWorkspace?.id;

  useEffect(() => {
    // An empty active workspace is WorkspaceProvider's job to fill.
    if (isPending || !activeId || checkedChannelId.current === roomId) {
      return;
    }

    // Checked once per channel, so a later manual workspace switch is not undone.
    checkedChannelId.current = roomId;
    if (activeId !== organizationId) switchWorkspace(organizationId);
  }, [activeId, roomId, isPending, organizationId, switchWorkspace]);
}
