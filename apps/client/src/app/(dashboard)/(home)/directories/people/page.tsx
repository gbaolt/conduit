import {
  Directory,
  DirectoryHeader,
  DirectoryTabs,
} from '@/features/workspace/components/directory/directory';
import {
  DirectoryInviteButton,
  DirectoryPeople,
} from '@/features/workspace/components/directory/directory-people';

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
