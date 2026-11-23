import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconSearch } from '@tabler/icons-react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { SearchField } from '@/features/search/components/search-field';
import { SearchResults } from '@/features/search/components/search-results';

export default function SearchPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader icon={IconSearch} title="Search" />
      <Suspense fallback={<Skeleton className="mx-4 my-4 h-10 rounded-md" />}>
        <div className="shrink-0 px-4 py-4">
          <SearchField />
        </div>
        <SearchResults />
      </Suspense>
    </div>
  );
}
