import { GeneralSettingsForm } from '@/features/workspace-settings/components/general-settings-form';

export default function GeneralSettingsPage() {
  return (
    <section aria-labelledby="general-heading" className="flex flex-col gap-4">
      <h2 id="general-heading" className="text-base font-semibold">
        General
      </h2>
      <GeneralSettingsForm />
    </section>
  );
}
