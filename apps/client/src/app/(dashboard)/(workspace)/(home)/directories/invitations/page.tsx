import {
  Directory,
  DirectoryHeader,
  DirectoryTabs,
} from '@/features/directories/components/directory';
import { DirectoryInvitations } from '@/features/directories/components/directory-invitations';
import { DirectoryInviteButton } from '@/features/directories/components/directory-people';

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
