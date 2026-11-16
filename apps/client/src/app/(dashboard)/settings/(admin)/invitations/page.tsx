import { InvitationsTable } from '@/features/workspace/components/workspace-settings/invitations-table';
import { InvitePeopleButton } from '@/features/workspace/components/workspace-settings/invite-people-button';
import { SettingsHeader } from '@/features/workspace/components/workspace-settings/settings-view';

export default function InvitationsPage() {
  return (
    <>
      <SettingsHeader
        title="Invitations"
        description="People you invited who have not joined yet. Each invitation link works for 7 days."
        action={<InvitePeopleButton />}
      />
      <InvitationsTable />
    </>
  );
}
