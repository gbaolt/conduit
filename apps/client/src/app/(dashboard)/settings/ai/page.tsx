import { AiSettingsForm } from '@/features/workspace/components/workspace-settings/ai-settings-form';
import { SettingsHeader } from '@/features/workspace/components/workspace-settings/settings-view';

export default function AiPage() {
  return (
    <>
      <SettingsHeader
        title="AI"
        description="Admins and owners decide whether members can use AI in this workspace."
      />
      <AiSettingsForm />
    </>
  );
}
