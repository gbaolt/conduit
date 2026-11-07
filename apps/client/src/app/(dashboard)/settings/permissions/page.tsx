import { PermissionsForm } from '@/features/workspace/components/workspace-settings/permissions-form';
import { SettingsHeader } from '@/features/workspace/components/workspace-settings/settings-view';

export default function PermissionsPage() {
  return (
    <>
      <SettingsHeader
        title="Permissions"
        description="Admins and owners can always start channels. These settings decide what members can do."
      />
      <PermissionsForm />
    </>
  );
}
