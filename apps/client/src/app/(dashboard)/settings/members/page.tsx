import { MembersTable } from '@/features/workspace-settings/components/members-table';

export default function MembersPage() {
  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-4">
      <h2 id="members-heading" className="text-base font-semibold">
        Members
      </h2>
      <MembersTable />
    </section>
  );
}
