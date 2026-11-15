import {
  Directory,
  DirectoryHeader,
  DirectoryTabs,
} from '@/features/workspace/components/directory/directory';
import { DirectoryInvitations } from '@/features/workspace/components/directory/directory-invitations';
import { DirectoryInviteButton } from '@/features/workspace/components/directory/directory-people';

export default function InvitationDirectoryPage() {
  return (
    <Directory>
      <DirectoryHeader>
        <DirectoryInviteButton />
      </DirectoryHeader>
      <DirectoryTabs />
      <DirectoryInvitations />
    </Directory>
  );
}
