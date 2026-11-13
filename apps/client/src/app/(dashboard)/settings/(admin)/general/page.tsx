import { GeneralSettingsForm } from '@/features/workspace/components/workspace-settings/general-settings-form';
import { SettingsHeader } from '@/features/workspace/components/workspace-settings/settings-view';

export default function GeneralSettingsPage() {
  return (
    <>
      <SettingsHeader
        title="General"
        description="The workspace's name, icon, and web address."
      />
      <GeneralSettingsForm />
    </>
  );
}
