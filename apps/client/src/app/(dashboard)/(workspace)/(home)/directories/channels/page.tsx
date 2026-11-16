import {
  Directory,
  DirectoryHeader,
  DirectoryTabs,
} from '@/features/directories/components/directory';
import {
  DirectoryChannels,
  DirectoryCreateChannelButton,
} from '@/features/directories/components/directory-channels';

export default function ChannelDirectoryPage() {
  return (
    <Directory>
      <DirectoryHeader>
        <DirectoryCreateChannelButton />
      </DirectoryHeader>
      <DirectoryTabs />
      <DirectoryChannels />
    </Directory>
  );
}
