import { PermissionsForm } from '@/features/workspace-settings/components/permissions-form';

export default function PermissionsPage() {
  return (
    <section
      aria-labelledby="permissions-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="permissions-heading" className="text-base font-semibold">
        Permissions
      </h2>
      <PermissionsForm />
    </section>
  );
}
