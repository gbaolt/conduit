import {
  Directory,
  DirectoryHeader,
  DirectoryTabs,
} from '@/features/directories/components/directory';
import {
  DirectoryInviteButton,
  DirectoryPeople,
} from '@/features/directories/components/directory-people';

export default function PeopleDirectoryPage() {
  return (
    <Directory>
      <DirectoryHeader>
        <DirectoryInviteButton />
      </DirectoryHeader>
      <DirectoryTabs />
      <DirectoryPeople />
    </Directory>
  );
}
