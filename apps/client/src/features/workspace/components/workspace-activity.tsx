'use client';

import { useSidebarStream } from '@/services/activity/hooks';

import { useWorkspace } from '../context/workspace-provider';

function ActivityStreams() {
  useSidebarStream();
  return null;
}

/**
 * Opens the workspace-wide live streams once for the whole app: read state and drafts now,
 * presence later. The key restarts them when the viewer switches workspace.
 */
export function WorkspaceActivity() {
  const { activeWorkspace } = useWorkspace();

  return activeWorkspace ? <ActivityStreams key={activeWorkspace.id} /> : null;
}
