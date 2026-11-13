import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import {
  NotificationSettingsSchema,
  UpdateNotificationSettingsInputSchema,
} from '@/schemas/notifications';

export const getNotificationSettingsContract = oc
  .meta(openapi({ method: 'GET', path: '/notification-settings' }))
  .output(NotificationSettingsSchema);

export const updateNotificationSettingsContract = oc
  .meta(openapi({ method: 'PATCH', path: '/notification-settings' }))
  .input(UpdateNotificationSettingsInputSchema)
  .output(NotificationSettingsSchema);
