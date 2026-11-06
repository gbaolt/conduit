import type {
  UpdateWorkspaceSettingsInput,
  WorkspaceSettings,
} from '@conduit/contract';

/** A workspace with no settings row gets `DEFAULT_WORKSPACE_SETTINGS`. */
export abstract class WorkspaceSettingsRepository {
  abstract get(organizationId: string): Promise<WorkspaceSettings>;

  /** Creates the row on first use. */
  abstract update(
    organizationId: string,
    input: UpdateWorkspaceSettingsInput
  ): Promise<WorkspaceSettings>;
}
