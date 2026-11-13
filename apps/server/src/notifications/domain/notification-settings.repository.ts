import type {
  NotificationSettings,
  UpdateNotificationSettingsInput,
} from '@conduit/contract';

/** One member's settings in one workspace. */
export type NotificationScope = { organizationId: string; userId: string };

/** A member with no settings row gets `DEFAULT_NOTIFICATION_SETTINGS`. */
export abstract class NotificationSettingsRepository {
  abstract get(scope: NotificationScope): Promise<NotificationSettings>;

  /** Creates the row on first use. A field left out of `patch` stays as it is. */
  abstract update(
    scope: NotificationScope,
    patch: UpdateNotificationSettingsInput
  ): Promise<NotificationSettings>;
}
