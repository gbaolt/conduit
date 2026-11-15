import {
  canCreateChannel,
  DEFAULT_WORKSPACE_SETTINGS,
  type Room,
} from '@conduit/contract';

import {
  useWorkspaceRole,
  useWorkspaceSettings,
} from '@/services/workspaces/hooks';

/** Mirrors the server check so the UI hides what the server would refuse. Settings default until they load. */
export function useCanCreateChannel(visibility: Room['visibility']) {
  const role = useWorkspaceRole();
  const { data: settings = DEFAULT_WORKSPACE_SETTINGS } =
    useWorkspaceSettings();

  return canCreateChannel(role, visibility, settings);
}
