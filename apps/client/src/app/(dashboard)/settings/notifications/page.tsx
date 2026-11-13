import { NotificationsForm } from '@/features/workspace/components/workspace-settings/notifications/notifications-form';
import { SettingsHeader } from '@/features/workspace/components/workspace-settings/settings-view';

export default function NotificationsPage() {
  return (
    <>
      <SettingsHeader
        title="Notifications"
        description="Choose when Conduit stays quiet. Set the level for a channel or conversation from its menu."
      />
      <NotificationsForm />
    </>
  );
}
