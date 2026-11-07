import type { WorkspaceRole } from '@conduit/contract';

/** The signed-in user acting in the active workspace. */
export type WorkspaceViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};
