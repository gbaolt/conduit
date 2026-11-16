import {
  Directory,
  DirectoryHeader,
  DirectoryTabs,
} from '@/features/workspace/components/directory/directory';
import {
  DirectoryChannels,
  DirectoryCreateChannelButton,
} from '@/features/workspace/components/directory/directory-channels';

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
