import type { AiSettings } from '@conduit/contract';

/** A workspace with no settings row gets `DEFAULT_AI_SETTINGS`. */
export abstract class AiSettingsRepository {
  abstract get(organizationId: string): Promise<AiSettings>;

  /** Creates the workspace's settings row on first use. */
  abstract set(
    organizationId: string,
    settings: AiSettings
  ): Promise<AiSettings>;
}
