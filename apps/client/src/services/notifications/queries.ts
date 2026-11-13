import { orpc } from '@/lib/orpc';

export const notificationSettingsQuery =
  orpc.notificationSettings.get.queryOptions();
