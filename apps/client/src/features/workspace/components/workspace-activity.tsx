'use client';

import {
  useHeartbeat,
  usePresenceStream,
  useSidebarStream,
} from '@/services/activity/hooks';
import { useFeedStream } from '@/services/feed/hooks';

import { useWorkspace } from '../context/workspace-provider';

function ActivityStreams() {
  useSidebarStream();
  usePresenceStream();
  useFeedStream();
  useHeartbeat();
  return null;
}

/**
 * Opens the workspace-wide live streams and the heartbeat once for the whole app: read state and drafts
 * for the sidebar, and presence. The key restarts them when the viewer switches workspace.
 */
export function WorkspaceActivity() {
  const { activeWorkspace } = useWorkspace();

  return activeWorkspace ? <ActivityStreams key={activeWorkspace.id} /> : null;
}
