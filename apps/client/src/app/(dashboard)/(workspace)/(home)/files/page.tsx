import { IconFolder } from '@tabler/icons-react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  FilesList,
  FilesListSkeleton,
} from '@/features/files/components/files-list';
import {
  FilesToolbar,
  FilesToolbarSkeleton,
} from '@/features/files/components/files-toolbar';

export default function FilesPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader icon={IconFolder} title="Files" />
      <Suspense fallback={<FilesToolbarSkeleton />}>
        <FilesToolbar />
      </Suspense>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-8">
        <Suspense fallback={<FilesListSkeleton />}>
          <FilesList />
        </Suspense>
      </div>
    </div>
  );
}
